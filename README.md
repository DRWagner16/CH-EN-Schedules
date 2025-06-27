Step 1: Add New Data to Your Google Sheet
This is the only step that happens outside of GitHub.
In your Google Drive, either open the Google Sheet for the new academic year (e.g., "Teaching Assignments 2026-2027") or create it.
Add a new tab (worksheet) for the upcoming semester (e.g., "Fall 2026 Summary").
Fill this tab with all the course information, making sure the column headers (COURSE, TYPE, INSTRUCTOR, etc.) are correct.
Ensure the sheet is shared with the ...iam.gserviceaccount.com email address with "Viewer" permissions.

Step 2: Update the config.json File
This is the only file you need to edit in your GitHub repository.
Go to your GitHub repository.
Open the config.json file.
Add a new "semester object" to the semesters list. Copy and paste an existing one and update the details for the new semester. Make sure the google_sheet_file_name and worksheet_tab_name match your new Google Sheet exactly.
Example: Adding Fall 2026

JSON
{
  "current_semester_id": "F26",
  "semesters": [
    {
      "id": "F26",
      "display_title": "Fall 2026",
      "google_sheet_file_name": "Teaching Assignments 2026-2027",
      "worksheet_tab_name": "Fall Summary",
      "output_json_file": "F26schedule.json"
    },
    {
      "id": "S26",
      "display_title": "Spring 2026",
      "google_sheet_file_name": "Teaching Assignments 2025-2026",
      "worksheet_tab_name": "Spring Summary",
      "output_json_file": "S26schedule.json"
    }
  ]
}

Update the current_semester_id to the id of the semester you want the website to load by default.
Commit this change to your repository.

Step 3: Run the Automation
After you commit the change to config.json:
Go to the Actions tab in your GitHub repository.
Select the "Update Schedule Data from Google Sheet" workflow.
Click the "Run workflow" button to trigger it manually.
