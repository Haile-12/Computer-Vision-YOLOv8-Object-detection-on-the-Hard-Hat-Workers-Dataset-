# Delete Button Troubleshooting Guide

## Step 1: Clear Browser Cache
1. Open your browser with the YOLOv8 frontend
2. Press `Ctrl + Shift + Delete` (or `Cmd + Shift + Delete` on Mac)
3. Select "Cached images and files"
4. Click "Clear data"

## Step 2: Hard Refresh
1. Go to `file:///D:/YOLOv8/frontend/index.html`
2. Press `Ctrl + F5` (or `Cmd + Shift + R` on Mac) to hard refresh

## Step 3: Open Developer Console
1. Press `F12` to open Developer Tools
2. Click on the "Console" tab
3. Navigate to the History section in the app

## Step 4: Check Console Logs
You should see logs like:
```
Creating delete button for item: <some-uuid>
```

## Step 5: Test Delete Button
1. Hover over a gallery card - you should see a red delete button appear
2. Click the delete button
3. Check the console for:
   - "🗑️ Delete button clicked! ID: <uuid>"
   - "Requesting delete for ID: <uuid>"

## Step 6: Alternative Test Page
If the main app still doesn't work, open:
`file:///D:/YOLOv8/frontend/debug_delete.html`

This page has detailed logging and will help identify the issue.

## Common Issues:

### Issue 1: Button Not Visible
- Check if CSS is loaded properly
- Inspect element to see if `.gallery-btn-delete` class exists

### Issue 2: Button Not Clickable
- Check z-index in CSS
- Verify onclick handler is attached (check in Elements tab)

### Issue 3: Delete Request Fails
- Verify backend is running: http://127.0.0.1:8000/docs
- Check Network tab in DevTools for failed requests

### Issue 4: CORS Error
- Backend should have CORS enabled (already configured)
- Check console for CORS-related errors
