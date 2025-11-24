export const vertexShader = `
uniform float uTime;
uniform sampler2D uTexture;
uniform float uAudioHigh; 
uniform float uAudioMid;  
uniform float uAudioLow;  
uniform float uDisplacementStrength;
uniform float uParticleSize;
uniform int uMode; 

// New Uniforms
uniform float uContrast;
uniform float uBrightness;
uniform float uMinDepth;
uniform float uMaxDepth;

varying vec2 vUv;
varying vec3 vColor;
varying float vLife;

// Simplex noise function
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
           -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
  + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vUv = uv;
  
  // Sample video texture
  vec4 videoColor = texture2D(uTexture, uv);
  
  // Apply Contrast and Brightness
  vec3 color = videoColor.rgb;
  color = (color - 0.5) * uContrast + 0.5 + uBrightness;
  
  // Calculate perceived brightness (luma) for "depth"
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  
  // Depth culling/fading
  // If luma is outside range, we can shrink particle to 0
  float depthVisibility = smoothstep(uMinDepth, uMinDepth + 0.1, luma) * (1.0 - smoothstep(uMaxDepth - 0.1, uMaxDepth, luma));
  
  vec3 pos = position;
  
  // --- MODES ---
  
  // MODE 0: Classic Depth Map
  if (uMode == 0) {
    float zDisp = luma * (1.0 + uAudioLow * 2.0) * uDisplacementStrength;
    pos.z += zDisp;
  } 
  // MODE 1: Wave/Ripple
  else if (uMode == 1) {
    float noiseVal = snoise(uv * 3.0 + uTime * 0.5);
    float wave = sin(uv.x * 10.0 + uTime + uAudioMid * 5.0) * 0.5;
    pos.z += (luma * uDisplacementStrength) + wave + (noiseVal * uAudioHigh);
  }
  // MODE 2: Glitch/Scatter
  else if (uMode == 2) {
    float noiseVal = snoise(uv * 10.0 + uTime * 2.0);
    if (noiseVal > 0.5 - (uAudioHigh * 0.3)) {
        pos.x += noiseVal * 0.2 * uAudioLow;
        pos.y += noiseVal * 0.2 * uAudioLow;
    }
    pos.z += luma * uDisplacementStrength;
  }
  // MODE 3: Vortex
  else if (uMode == 3) {
    float angle = atan(pos.y, pos.x);
    float radius = length(pos.xy);
    float twist = uAudioLow * 5.0 * (1.0 / (radius + 0.1));
    float newAngle = angle + twist + uTime * 0.5;
    
    // Orbit
    pos.x = radius * cos(newAngle);
    pos.y = radius * sin(newAngle);
    pos.z += luma * uDisplacementStrength;
  }
  // MODE 4: Rain
  else if (uMode == 4) {
    // Fall down
    float fallSpeed = 2.0 + uAudioMid * 5.0;
    float yOffset = -mod(uTime * fallSpeed + uv.y * 10.0, 10.0); // Loop
    pos.y += yOffset;
    if (pos.y < -4.5) pos.y += 9.0; // Wrap around screen height approx
    
    pos.z += luma * uDisplacementStrength;
  }

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  
  // Pass color to fragment
  vColor = color;
  
  // Size attenuation based on depth/audio
  gl_PointSize = uParticleSize * (0.5 + luma + uAudioMid) * depthVisibility;
}
`;

export const fragmentShader = `
uniform int uColorMode; // 0: Original, 1: Cyberpunk, 2: Heatmap, 3: Neon
uniform float uAudioLow;
uniform float uAudioHigh;

varying vec2 vUv;
varying vec3 vColor;

void main() {
  vec3 finalColor = vColor;

  // Circular particle shape
  vec2 center = gl_PointCoord - 0.5;
  float dist = length(center);
  if (dist > 0.5) discard;
  
  // Soft edge
  float alpha = 1.0 - smoothstep(0.4, 0.5, dist);

  float gray = dot(finalColor, vec3(0.299, 0.587, 0.114));

  if (uColorMode == 1) {
    // Cyberpunk: boost cyan/magenta
    vec3 cyan = vec3(0.0, 1.0, 1.0);
    vec3 magenta = vec3(1.0, 0.0, 1.0);
    finalColor = mix(cyan, magenta, gray + uAudioLow * 0.5);
  } else if (uColorMode == 2) {
    // Heatmap style
    vec3 cold = vec3(0.0, 0.0, 0.5);
    vec3 hot = vec3(1.0, 0.5, 0.0);
    finalColor = mix(cold, hot, gray * (1.0 + uAudioLow));
  } else if (uColorMode == 3) {
    // Neon Edges
    vec3 neonGreen = vec3(0.0, 1.0, 0.2);
    vec3 neonPink = vec3(1.0, 0.0, 0.8);
    if (gray > 0.5) {
        finalColor = mix(neonGreen, neonPink, uAudioHigh);
    } else {
        finalColor = vec3(0.05);
    }
  }

  gl_FragColor = vec4(finalColor, alpha);
}
`;
