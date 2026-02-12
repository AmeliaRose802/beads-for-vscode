const assert = require('assert');

/**
 * Page size storage utilities for testing.
 */
const STORAGE_KEY = 'beads-ui-page-size';

/**
 * Get page size from a storage object or use default.
 * This is a test-friendly version that accepts a storage parameter.
 * @param {Object} storage - Storage object with getItem method
 * @returns {number|string} Page size value
 */
function getStoredPageSize(storage) {
  try {
    const stored = storage.getItem(STORAGE_KEY);
    if (stored === 'all') return 'all';
    const parsed = parseInt(stored, 10);
    return [50, 100, 200].includes(parsed) ? parsed : 50;
  } catch {
    return 50;
  }
}

/**
 * Paginate an array of items.
 * @param {Array} items - Items to paginate
 * @param {number} page - Current page (1-indexed)
 * @param {number|string} pageSize - Items per page or 'all'
 * @returns {Array} Paginated items
 */
function paginateItems(items, page, pageSize) {
  if (pageSize === 'all') return items;
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

/**
 * Calculate total pages.
 * @param {number} totalItems - Total item count
 * @param {number|string} pageSize - Items per page or 'all'
 * @returns {number} Total number of pages
 */
function calculateTotalPages(totalItems, pageSize) {
  if (pageSize === 'all' || totalItems === 0) return 1;
  return Math.ceil(totalItems / pageSize);
}

// Mock localStorage for testing
const mockLocalStorage = {
  store: {},
  getItem(key) {
    return this.store[key] || null;
  },
  setItem(key, value) {
    this.store[key] = value;
  },
  clear() {
    this.store = {};
  }
};

suite('Pagination Tests', () => {
  suite('paginateItems', () => {
    const testItems = Array.from({ length: 150 }, (_, i) => ({
      id: `item-${i + 1}`,
      title: `Item ${i + 1}`
    }));

    test('Should return all items when pageSize is "all"', () => {
      const result = paginateItems(testItems, 1, 'all');
      assert.strictEqual(result.length, 150);
      assert.deepStrictEqual(result, testItems);
    });

    test('Should return first page with pageSize 50', () => {
      const result = paginateItems(testItems, 1, 50);
      assert.strictEqual(result.length, 50);
      assert.strictEqual(result[0].id, 'item-1');
      assert.strictEqual(result[49].id, 'item-50');
    });

    test('Should return second page with pageSize 50', () => {
      const result = paginateItems(testItems, 2, 50);
      assert.strictEqual(result.length, 50);
      assert.strictEqual(result[0].id, 'item-51');
      assert.strictEqual(result[49].id, 'item-100');
    });

    test('Should return third page with pageSize 50 (partial)', () => {
      const result = paginateItems(testItems, 3, 50);
      assert.strictEqual(result.length, 50);
      assert.strictEqual(result[0].id, 'item-101');
      assert.strictEqual(result[49].id, 'item-150');
    });

    test('Should return empty array for page beyond items', () => {
      const result = paginateItems(testItems, 10, 50);
      assert.strictEqual(result.length, 0);
    });

    test('Should handle pageSize 100', () => {
      const result = paginateItems(testItems, 1, 100);
      assert.strictEqual(result.length, 100);
    });

    test('Should handle pageSize 200 with fewer items', () => {
      const result = paginateItems(testItems, 1, 200);
      assert.strictEqual(result.length, 150);
    });

    test('Should handle empty array', () => {
      const result = paginateItems([], 1, 50);
      assert.strictEqual(result.length, 0);
    });
  });

  suite('calculateTotalPages', () => {
    test('Should return 1 when pageSize is "all"', () => {
      assert.strictEqual(calculateTotalPages(150, 'all'), 1);
    });

    test('Should return 1 when totalItems is 0', () => {
      assert.strictEqual(calculateTotalPages(0, 50), 1);
    });

    test('Should calculate pages correctly for exact division', () => {
      assert.strictEqual(calculateTotalPages(100, 50), 2);
      assert.strictEqual(calculateTotalPages(200, 100), 2);
    });

    test('Should round up for partial pages', () => {
      assert.strictEqual(calculateTotalPages(75, 50), 2);
      assert.strictEqual(calculateTotalPages(101, 100), 2);
      assert.strictEqual(calculateTotalPages(150, 50), 3);
    });
  });

  suite('getStoredPageSize with mock localStorage', () => {
    setup(() => {
      mockLocalStorage.clear();
    });

    test('Should return default 50 when nothing stored', () => {
      const result = getStoredPageSize(mockLocalStorage);
      assert.strictEqual(result, 50);
    });

    test('Should return "all" when stored', () => {
      mockLocalStorage.setItem(STORAGE_KEY, 'all');
      const result = getStoredPageSize(mockLocalStorage);
      assert.strictEqual(result, 'all');
    });

    test('Should return valid stored page size', () => {
      mockLocalStorage.setItem(STORAGE_KEY, '100');
      const result = getStoredPageSize(mockLocalStorage);
      assert.strictEqual(result, 100);
    });

    test('Should return default for invalid stored value', () => {
      mockLocalStorage.setItem(STORAGE_KEY, '75');
      const result = getStoredPageSize(mockLocalStorage);
      assert.strictEqual(result, 50);
    });
  });

  suite('Ready view display with pagination', () => {
    test('Should display all ready items with "all" page size', () => {
      const readyIssues = Array.from({ length: 25 }, (_, i) => ({
        id: `ready-${i + 1}`,
        title: `Ready item ${i + 1}`,
        type: 'task',
        status: 'open'
      }));
      
      const paginated = paginateItems(readyIssues, 1, 'all');
      assert.strictEqual(paginated.length, 25);
    });

    test('Should paginate ready items correctly', () => {
      const readyIssues = Array.from({ length: 75 }, (_, i) => ({
        id: `ready-${i + 1}`,
        title: `Ready item ${i + 1}`,
        type: 'task',
        status: 'open'
      }));
      
      const page1 = paginateItems(readyIssues, 1, 50);
      const page2 = paginateItems(readyIssues, 2, 50);
      
      assert.strictEqual(page1.length, 50);
      assert.strictEqual(page2.length, 25);
      assert.strictEqual(page1[0].id, 'ready-1');
      assert.strictEqual(page2[0].id, 'ready-51');
    });

    test('Should handle ready view with different issue types', () => {
      const readyIssues = [
        { id: 'r-1', type: 'epic', status: 'open' },
        { id: 'r-2', type: 'feature', status: 'open' },
        { id: 'r-3', type: 'bug', status: 'open' },
        { id: 'r-4', type: 'task', status: 'open' },
        { id: 'r-5', type: 'chore', status: 'open' }
      ];
      
      const paginated = paginateItems(readyIssues, 1, 50);
      assert.strictEqual(paginated.length, 5);
      
      // Verify all types are present
      const types = paginated.map(i => i.type);
      assert.ok(types.includes('epic'));
      assert.ok(types.includes('feature'));
      assert.ok(types.includes('bug'));
      assert.ok(types.includes('task'));
      assert.ok(types.includes('chore'));
    });
  });
});
