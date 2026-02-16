/**
 * Page size options available for pagination.
 * @type {Array<{value: number|string, label: string}>}
 */
const PAGE_SIZE_OPTIONS = [
  { value: 50, label: '50' },
  { value: 100, label: '100' },
  { value: 200, label: '200' },
  { value: 'all', label: 'All' }
];

/**
 * Pagination controls component for list and ready views.
 * Provides page size selection and prev/next navigation.
 * @param {Object} props - Component props
 * @param {number} props.currentPage - Current page number (1-indexed)
 * @param {number|string} props.pageSize - Items per page or 'all'
 * @param {number} props.totalItems - Total number of items
 * @param {Function} props.onPageChange - Callback when page changes
 * @param {Function} props.onPageSizeChange - Callback when page size changes
 */
const PaginationControls = ({ 
  currentPage, 
  pageSize, 
  totalItems, 
  onPageChange, 
  onPageSizeChange 
}) => {
  const effectivePageSize = pageSize === 'all' ? totalItems : pageSize;
  const totalPages = effectivePageSize > 0 ? Math.ceil(totalItems / effectivePageSize) : 1;
  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= totalPages;

  const handlePrev = () => {
    if (!isFirstPage) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (!isLastPage) {
      onPageChange(currentPage + 1);
    }
  };

  const handlePageSizeChange = (e) => {
    const value = e.target.value;
    const newPageSize = value === 'all' ? 'all' : parseInt(value, 10);
    onPageSizeChange(newPageSize);
  };

  // Don't show pagination if showing all or only one page
  const showNavigation = pageSize !== 'all' && totalPages > 1;

  return (
    <div className="pagination-controls">
      <div className="pagination-controls__size">
        <label className="pagination-controls__label">Show:</label>
        <select 
          className="pagination-controls__select"
          value={pageSize}
          onChange={handlePageSizeChange}
        >
          {PAGE_SIZE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      
      {showNavigation && (
        <div className="pagination-controls__nav">
          <button 
            className="pagination-controls__btn"
            onClick={handlePrev}
            disabled={isFirstPage}
            title="Previous page"
          >
            ◀
          </button>
          <span className="pagination-controls__indicator">
            {currentPage} / {totalPages}
          </span>
          <button 
            className="pagination-controls__btn"
            onClick={handleNext}
            disabled={isLastPage}
            title="Next page"
          >
            ▶
          </button>
        </div>
      )}
      
      <div className="pagination-controls__info">
        {totalItems} item{totalItems !== 1 ? 's' : ''}
      </div>
    </div>
  );
};

export default PaginationControls;
