# React UI Development Guidelines

## Critical Rules

### NO Inline Styles
- **NEVER** use inline `style={{}}` attributes in JSX
- **ALL** styles must be defined in CSS files (e.g., `styles.css`)
- Use CSS classes and className attributes instead
- Exception: Only use inline styles for truly dynamic values that cannot be expressed in CSS (rare)

### Component Organization
- Split large component files (>500 lines) into separate modules
- One component per file in a `components/` directory
- Main App component should primarily compose other components
- Component files should be under 300 lines ideally

### File Structure
```
webview/
  ├── App.jsx              # Main app, composes components
  ├── components/          # Reusable components
  │   ├── IssueCard.jsx
  │   ├── StatsDisplay.jsx
  │   └── ...
  ├── styles.css           # All styles
  └── index.jsx            # Entry point
```

### CSS Organization
- Group related styles together with comments
- Use VS Code theme variables (e.g., `var(--vscode-foreground)`)
- Follow BEM or component-based naming conventions
- Keep selectors simple and maintainable

### Best Practices
- Extract utility functions to separate files
- Use semantic HTML elements
- Prefer CSS for hover/active states over JavaScript
- Keep components focused and single-purpose
- Extract repeated JSX patterns into reusable components

## Examples

### ❌ BAD - Inline Styles
```jsx
<div style={{ padding: '8px', backgroundColor: 'red' }}>
  Content
</div>
```

### ✅ GOOD - CSS Classes
```jsx
// JSX
<div className="issue-card">
  Content
</div>

// CSS
.issue-card {
  padding: 8px;
  background-color: var(--vscode-editor-background);
}
```

### ❌ BAD - Monolithic Component
```jsx
// 800 line App.jsx with all components inline
```

### ✅ GOOD - Split Components
```jsx
// App.jsx
import IssueCard from './components/IssueCard';

// components/IssueCard.jsx
export default function IssueCard({ issue }) {
  return <div className="issue-card">...</div>;
}
```
