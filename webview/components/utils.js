/**
 * Parse comments from command line output
 * @param {string} output - Raw command output
 * @returns {Array} Parsed comments array
 */
export const parseComments = (output) => {
  if (output.includes('No comments')) {
    return [];
  }
  
  const lines = output.split('\n');
  const commentList = [];
  
  for (let line of lines) {
    // Match format: [AUTHOR] Comment text at TIMESTAMP
    const match = line.match(/^\[(.+?)\]\s+(.+?)\s+at\s+(.+)$/);
    if (match) {
      commentList.push({
        author: match[1],
        text: match[2],
        timestamp: match[3]
      });
    }
  }
  
  return commentList;
};