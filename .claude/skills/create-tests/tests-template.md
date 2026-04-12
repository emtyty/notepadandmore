# {Feature Name} - Test Cases

{1-3 sentences describing what this test suite covers.}

---

## Test Scenarios

### Test 1: {Short descriptive test name}

**Type**: Component Test | E2E Test | Unit Test  
**Category**: Functional | Edge Case | Error Handling | Integration

**Preconditions**
- {Required state, data, or setup — e.g., "Vessel app is running", "Luma config is loaded"}
- {e.g., "No active builds in progress"}

**Steps**

1. {Action — e.g., "Open the Dashboard page in Vessel"}
2. {Action — e.g., "Click 'New Build' and select app: Luma, env: debug, action: publish"}
3. {Action — e.g., "Click 'Start Build'"}
4. {Action — e.g., "Observe the Build Detail page"}

**Expected Result**

- {e.g., "Build card appears with status 'running'"}
- {e.g., "Pipeline visualization shows Level 0 plugins in progress"}
- {e.g., "Log viewer streams output in real time"}

**Status:** Not Tested

---

### Test 2: {Short descriptive test name}

**Type**: Unit Test  
**Category**: Edge Case

**Preconditions**
- {e.g., "BuildContext with skipSign: true"}

**Steps**

1. {e.g., "Call electron plugin's `shouldRun()` with skipSign: true"}

**Expected Result**

- {e.g., "`shouldRun()` returns true (skipSign only affects signing, not the build)"}

**Status:** Not Tested

---

### Test 3: {Short descriptive test name}

**Type**: E2E Test  
**Category**: Error Handling

**Preconditions**
- {e.g., "Vessel app is running with invalid AWS credentials configured"}

**Steps**

1. {Action}
2. {Action}

**Expected Result**

- {e.g., "Build fails at S3 upload step with a clear error message"}
- {e.g., "Error is displayed in the log viewer with the plugin name and error details"}
- {e.g., "Other completed build steps remain visible (not cleared)"}

**Status:** Not Tested
