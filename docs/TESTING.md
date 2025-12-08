# Beads UI Extension - Testing

This extension includes comprehensive test coverage to ensure reliability and maintainability.

## Test Structure

### Test Suites

1. **Extension Activation** - Tests extension loading and command registration
2. **BeadsViewProvider** - Tests webview provider initialization and configuration
3. **Command Execution** - Tests command execution logic and error handling
4. **Message Handling** - Tests communication between webview and extension
5. **Extension Deactivation** - Tests cleanup functionality
6. **Error Handling** - Tests various error scenarios
7. **Security** - Tests command execution security
8. **Integration** - End-to-end integration tests

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Unit Tests Only
```bash
npm run test:unit
```

### Run Tests in VS Code
1. Press `F5` or go to Run & Debug
2. Select "Extension Tests" configuration
3. Click the green play button

## Test Coverage

The test suite covers:

- ✅ Extension activation and deactivation
- ✅ Command registration (`beads-ui.open`)
- ✅ Webview provider initialization
- ✅ HTML content loading
- ✅ Message passing (extension ↔️ webview)
- ✅ Command execution with `bd` CLI
- ✅ Working directory detection
- ✅ Environment variable handling (BEADS_DB)
- ✅ Error handling (timeouts, ENOENT, buffer overflow)
- ✅ Output formatting and trimming
- ✅ Successful and failed command scenarios
- ✅ Security (command prefixing)

## Writing New Tests

Add new tests to `test/suite/extension.test.js`:

```javascript
test('Should do something', () => {
  // Arrange
  const expected = 'value';
  
  // Act
  const result = someFunction();
  
  // Assert
  assert.strictEqual(result, expected);
});
```

## Test Dependencies

- **Mocha** - Test framework
- **Sinon** - Mocking and stubbing
- **@vscode/test-electron** - VS Code extension testing
- **glob** - File pattern matching

## Continuous Integration

These tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run tests
  run: |
    npm install
    xvfb-run -a npm test  # Linux
    # Or: npm test  # Windows/Mac
```

## Debugging Tests

1. Set breakpoints in test files
2. Use "Extension Tests" debug configuration
3. Step through test execution
4. Inspect variables and call stacks

## Test Best Practices

- Use descriptive test names
- Follow Arrange-Act-Assert pattern
- Mock external dependencies
- Clean up in teardown functions
- Test both success and failure paths
- Keep tests independent and isolated
