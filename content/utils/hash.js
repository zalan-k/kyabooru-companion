/**
 * Image Hashing Utilities
 * Provides functions for image deduplication using Perceptual Hash (pHash)
 */
window.TagSaver = window.TagSaver || {};
window.TagSaver.Hash = (function() {
  
  // Cache to avoid re-computing hashes
  const hashCache = {};
  
  /**
   * Compute perceptual hash (pHash) for an image - UPDATED METHOD
   * @param {string} imageUrl
   * @returns {Promise<string>}
   */
  async function computeAverageHash(imageUrl) {
    // Check cache first
    if (hashCache[imageUrl]) {
      console.log(`Using cached hash for ${imageUrl.substring(0, 50)}...`);
      return hashCache[imageUrl];
    }
    
    if (/\.(mp4|webm|mov|gif)/i.test(imageUrl)) {
      try {
        console.log(`Computing hash from first frame of video: ${imageUrl.substring(0, 50)}...`);
        const result = await extractVideoFirstFrame(imageUrl);
        
        // Cache the hash
        hashCache[imageUrl] = result.hash;
        return result.hash;
      } catch (error) {
        console.error("Error computing video hash:", error);
        throw error;
      }
    }

    return new Promise((resolve, reject) => {
      console.log(`Computing pHash for ${imageUrl.substring(0, 50)}...`);
      
      const img = new Image();
      
      // Set timeout to avoid hanging on image load
      const timeoutId = setTimeout(() => {
        reject(new Error(`Image load timeout: ${imageUrl}`));
      }, 10000);
      
      img.onload = function() {
        clearTimeout(timeoutId);
        try {
          // Use perceptual hash instead of average hash
          const hashHex = computePerceptualHash(img, 16, [255, 255, 255]);
          
          // Cache the result
          hashCache[imageUrl] = hashHex;
          
          console.log(`pHash computed: ${hashHex}`);
          resolve(hashHex);
        } catch (error) {
          console.error("Error computing pHash:", error);
          reject(error);
        }
      };
      
      img.onerror = function(e) {
        clearTimeout(timeoutId);
        console.error(`Failed to load image for hashing: ${imageUrl}`, e);
        reject(new Error(`Failed to load image: ${imageUrl}`));
      };
      
      // Load image with proper error handling
      try {
        img.crossOrigin = 'Anonymous';
        img.src = imageUrl;
      } catch (error) {
        clearTimeout(timeoutId);
        console.error(`Error setting image src: ${imageUrl}`, error);
        reject(error);
      }
    });
  }
  
  /**
   * Compute perceptual hash using DCT - with transparency handling
   * @param {HTMLImageElement} imageElement 
   * @param {number} size - Canvas size (default 16)
   * @param {Array} backgroundColor - RGB background color for transparency
   * @returns {string} - Hex hash string
   */
  function computePerceptualHash(imageElement, size = 16, backgroundColor = [255, 255, 255]) {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      canvas.width = size;
      canvas.height = size;
      
      // Fill with background color first (handles transparency)
      ctx.fillStyle = `rgb(${backgroundColor[0]}, ${backgroundColor[1]}, ${backgroundColor[2]})`;
      ctx.fillRect(0, 0, size, size);
      
      // Draw image on top (transparency will blend with background)
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(imageElement, 0, 0, size, size);
      
      const imageData = ctx.getImageData(0, 0, size, size).data;
      const grayPixels = [];
      
      // Convert to grayscale matrix
      for (let y = 0; y < size; y++) {
        grayPixels[y] = [];
        for (let x = 0; x < size; x++) {
          const i = (y * size + x) * 4;
          grayPixels[y][x] = 0.299 * imageData[i] + 0.587 * imageData[i+1] + 0.114 * imageData[i+2];
        }
      }
      
      // Apply 2D DCT (simplified version)
      const dctSize = 8;
      const dct = [];
      for (let u = 0; u < dctSize; u++) {
        dct[u] = [];
        for (let v = 0; v < dctSize; v++) {
          let sum = 0;
          for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
              sum += grayPixels[x][y] * 
                     Math.cos((2*x + 1) * u * Math.PI / (2*size)) *
                     Math.cos((2*y + 1) * v * Math.PI / (2*size));
            }
          }
          const cu = u === 0 ? 1/Math.sqrt(2) : 1;
          const cv = v === 0 ? 1/Math.sqrt(2) : 1;
          dct[u][v] = (2/size) * cu * cv * sum;
        }
      }
      
      // Get average of DCT coefficients (excluding DC component)
      let sum = 0;
      let count = 0;
      for (let y = 0; y < dctSize; y++) {
        for (let x = 0; x < dctSize; x++) {
          if (x !== 0 || y !== 0) { // Skip DC component
            sum += dct[y][x];
            count++;
          }
        }
      }
      const avg = sum / count;
      
      // Generate hash
      let hashBits = '';
      for (let y = 0; y < dctSize; y++) {
        for (let x = 0; x < dctSize; x++) {
          if (x !== 0 || y !== 0) {
            hashBits += dct[y][x] >= avg ? '1' : '0';
          }
        }
      }
      
      return binaryToHex(hashBits);
    } catch (error) {
      console.error('Error in computePerceptualHash:', error);
      throw error;
    }
  }
  
  /**
   * Convert binary string to hex
   * @param {string} binaryStr - Binary string
   * @returns {string} - Hex string
   */
  function binaryToHex(binaryStr) {
    let output = '';
    // Process 4 bits at a time (1 hex digit = 4 binary digits)
    for (let i = 0; i < binaryStr.length; i += 4) {
      // Get 4 bits
      const chunk = binaryStr.substr(i, 4);
      // Convert to decimal
      const decimal = parseInt(chunk, 2);
      // Convert to hex
      output += decimal.toString(16);
    }
    return output;
  }
  
  /**
   * Calculate Hamming distance between two binary strings
   * @param {string} hash1 - First hash (hex)
   * @param {string} hash2 - Second hash (hex)
   * @returns {number} - Hamming distance
   */
  function hammingDistance(hash1, hash2) {
    if (!hash1 || !hash2) {
      console.error("Invalid hashes provided to hammingDistance", { hash1, hash2 });
      return Infinity; // Return a large distance for invalid hashes
    }
    
    try {
      // Convert hex to binary
      const bin1 = hexToBinary(hash1);
      const bin2 = hexToBinary(hash2);
      
      // Ensure equal length
      const minLength = Math.min(bin1.length, bin2.length);
      
      // Count differing bits
      let distance = 0;
      for (let i = 0; i < minLength; i++) {
        if (bin1[i] !== bin2[i]) {
          distance++;
        }
      }
      
      // Add difference in length as additional distance
      distance += Math.abs(bin1.length - bin2.length);
      
      return distance;
    } catch (error) {
      console.error("Error calculating hamming distance:", error);
      return Infinity; // Return a large distance on error
    }
  }
  
  /**
   * Convert hex string to binary string
   * @param {string} hex - Hex string
   * @returns {string} - Binary string
   */
  function hexToBinary(hex) {
    let binary = '';
    for (let i = 0; i < hex.length; i++) {
      const decimal = parseInt(hex[i], 16);
      const bits = decimal.toString(2).padStart(4, '0');
      binary += bits;
    }
    return binary;
  }
  
  /**
   * Check if two hashes are similar (threshold-based)
   * @param {string} hash1 - First hash
   * @param {string} hash2 - Second hash
   * @param {number} threshold - Similarity threshold (lower = more similar)
   * @returns {boolean} - Whether images are considered similar
   */
  function areSimilar(hash1, hash2, threshold = 8) { // CHANGED: Default threshold to 8
    const distance = hammingDistance(hash1, hash2);
    return distance <= threshold;
  }
  
  /**
   * Extract first frame from a video and calculate hash
   * @param {string} videoUrl - URL of the video
   * @returns {Promise<Object>} - Object with dataUrl and hash
   */
  async function extractVideoFirstFrame(videoUrl) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      
      // Set a timeout to avoid hanging on loading
      const timeoutId = setTimeout(() => {
        reject(new Error('Video load timeout'));
      }, 10000);
      
      // Add event listeners
      video.onloadedmetadata = () => {
        // Once metadata is loaded, seek to first frame
        video.currentTime = 0.1; // Slightly after start to ensure frame is loaded
      };
      
      video.onseeked = () => {
        clearTimeout(timeoutId);
        
        // Create canvas and draw frame
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Get data URL for preview
        const dataUrl = canvas.toDataURL('image/jpeg');
        
        // Calculate hash using pHash
        const hashHex = computePerceptualHash(video, 16, [255, 255, 255]);
        
        // Clean up
        video.src = '';
        
        resolve({
          dataUrl: dataUrl,
          hash: hashHex
        });
      };
      
      video.onerror = (e) => {
        clearTimeout(timeoutId);
        reject(new Error(`Error loading video: ${e.message}`));
      };
      
      // Load the video
      video.src = videoUrl;
      video.load();
    });
  }

  // Public API
  return {
    computeAverageHash, // KEEPING SAME NAME for compatibility
    hammingDistance,
    areSimilar,
    hexToBinary,
    binaryToHex,
    extractVideoFirstFrame
  };
})();