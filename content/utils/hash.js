/**
 * Image Hashing Utilities
 * Provides functions for image deduplication
 */
window.TagSaver = window.TagSaver || {};
window.TagSaver.Hash = (function() {
  
  /**
   * Compute average hash (aHash) for an image
   * @param {string} imageUrl - URL of the image
   * @returns {Promise<string>} - Hash as hex string
   */
  async function computeAverageHash(imageUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = function() {
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
            // Convert to grayscale
            const gray = Math.floor((imageData[i] + imageData[i+1] + imageData[i+2]) / 3);
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
          const hashHex = parseInt(hashString, 2).toString(16).padStart(16, '0');
          resolve(hashHex);
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = function() {
        reject(new Error(`Failed to load image: ${imageUrl}`));
      };
      
      // Load image
      img.crossOrigin = 'Anonymous';
      img.src = imageUrl;
    });
  }
  
  /**
   * Calculate Hamming distance between two binary strings
   * @param {string} hash1 - First hash (hex)
   * @param {string} hash2 - Second hash (hex)
   * @returns {number} - Hamming distance
   */
  function hammingDistance(hash1, hash2) {
    // Convert hex to binary
    const bin1 = parseInt(hash1, 16).toString(2).padStart(64, '0');
    const bin2 = parseInt(hash2, 16).toString(2).padStart(64, '0');
    
    // Count differing bits
    let distance = 0;
    for (let i = 0; i < bin1.length; i++) {
      if (bin1[i] !== bin2[i]) {
        distance++;
      }
    }
    
    return distance;
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
  
  // Public API
  return {
    computeAverageHash,
    hammingDistance,
    areSimilar
  };
})();