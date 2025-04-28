/**
 * Image Hashing Utilities
 * Provides functions for image deduplication
 */
window.TagSaver = window.TagSaver || {};
window.TagSaver.Hash = (function() {
  
  // Cache to avoid re-computing hashes
  const hashCache = {};
  
  /**
   * Compute average hash (aHash) for an image
   * @param {string} imageUrl - URL of the image
   * @returns {Promise<string>} - Hash as hex string
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
      console.log(`Computing hash for ${imageUrl.substring(0, 50)}...`);
      
      const img = new Image();
      
      // Set timeout to avoid hanging on image load
      const timeoutId = setTimeout(() => {
        reject(new Error(`Image load timeout: ${imageUrl}`));
      }, 10000); // 10 second timeout
      
      img.onload = function() {
        clearTimeout(timeoutId);
        try {
          // Create a small 8x8 canvas for the hash
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const size = 8;
          
          canvas.width = size;
          canvas.height = size;
          
          // Scale image to 8x8 and draw in grayscale
          ctx.drawImage(img, 0, 0, size, size);
          const imageData = ctx.getImageData(0, 0, size, size).data;
          
          // Calculate average pixel value
          let sum = 0;
          const grayPixels = [];
          
          for (let i = 0; i < imageData.length; i += 4) {
            // Convert to grayscale - use proper weighting for human perception
            const gray = Math.floor(0.299 * imageData[i] + 0.587 * imageData[i+1] + 0.114 * imageData[i+2]);
            grayPixels.push(gray);
            sum += gray;
          }
          
          const avg = sum / grayPixels.length;
          
          // Generate binary hash
          let hashString = '';
          for (let i = 0; i < grayPixels.length; i++) {
            // Add a 1 if pixel is above average, 0 otherwise
            hashString += grayPixels[i] >= avg ? '1' : '0';
          }
          
          // Convert binary string to hex for storage
          const hashHex = binaryToHex(hashString);
          
          // Cache the result
          hashCache[imageUrl] = hashHex;
          
          console.log(`Hash computed: ${hashHex}`);
          resolve(hashHex);
        } catch (error) {
          console.error("Error computing hash:", error);
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
  function areSimilar(hash1, hash2, threshold = 10) {
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
        
        // Calculate hash using the same algorithm as for images
        const smallCanvas = document.createElement('canvas');
        const size = 8;
        smallCanvas.width = size;
        smallCanvas.height = size;
        const smallCtx = smallCanvas.getContext('2d');
        smallCtx.drawImage(video, 0, 0, size, size);
        
        const imageData = smallCtx.getImageData(0, 0, size, size).data;
        let sum = 0;
        const grayPixels = [];
        
        for (let i = 0; i < imageData.length; i += 4) {
          const gray = Math.floor(0.299 * imageData[i] + 0.587 * imageData[i+1] + 0.114 * imageData[i+2]);
          grayPixels.push(gray);
          sum += gray;
        }
        
        const avg = sum / grayPixels.length;
        
        let hashString = '';
        for (let i = 0; i < grayPixels.length; i++) {
          hashString += grayPixels[i] >= avg ? '1' : '0';
        }
        
        // Convert binary to hex
        const hashHex = window.TagSaver.Hash.binaryToHex(hashString);
        
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
    computeAverageHash,
    hammingDistance,
    areSimilar,
    hexToBinary,
    binaryToHex,
    extractVideoFirstFrame
  };
})();