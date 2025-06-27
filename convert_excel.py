import pandas as pd
import json
import gspread
from oauth2client.service_account import ServiceAccountCredentials
from datetime import datetime
import os
import sys

# This helper function remains the same
def calculate_duration(time_str):
    if pd.isna(time_str) or time_str == "TBA" or '-' not in str(time_str):
        return None
    try:
        time_str = str(time_str).replace("AM", " AM").replace("PM", " PM")
        start_time_str, end_time_str = time_str.split('-')
        time_format = "%I:%M %p"
        start_time = datetime.strptime(start_time_str.strip(), time_format)
        end_time = datetime.strptime(end_time_str.strip(), time_format)
        duration = (end_time - start_time).total_seconds() / 60
        return int(duration)
    except (ValueError, AttributeError):
        return None

# This helper function remains the same
def process_sheet_data(df):
    if 'COURSE' in df.columns:
        df['course_number'] = df['COURSE'].astype(str)
    else:
        df['course_number'] = ''
    df['duration'] = df['TIME'].apply(calculate_duration)
    unscheduled_mask = df['duration'].isnull()
    df.loc[unscheduled_mask, 'TIME'] = 'Online/Asynchronous'
    df.loc[unscheduled_mask, 'DAYS'] = ''
    df = df.rename(columns={
        'INSTRUCTOR': 'instructors', 'DAYS': 'days', 'TIME': 'time_of_day',
        'LOCATION': 'location', 'TYPE': 'type', 'NOTES': 'notes',
        'ENROLL': 'anticipated_enrollment'
    })
    final_columns = [
        'course_number', 'instructors', 'days', 'time_of_day', 'duration', 
        'location', 'type', 'notes', 'anticipated_enrollment'
    ]
    for col in final_columns:
        if col not in df.columns:
            df[col] = ''
    df_final = df[final_columns]
    df_final = df_final.fillna({
        'instructors': 'TBD', 'days': '', 'time_of_day': 'TBD',
        'location': 'TBD', 'type': 'N/A', 'notes': '',
        'anticipated_enrollment': 0, 'duration': 0
    })
    return df_final.to_dict(orient='records')

def convert_all_semesters_to_json(client):
    """Processes all semester schedules defined in config.json."""
    with open('config.json', 'r') as f:
        config = json.load(f)

    for semester in config['semesters']:
        # ... (This entire section remains the same as before)
        # It will process each semester and save its JSON file
        try:
            google_sheet_name = semester['google_sheet_file_name']
            worksheet_name = semester['worksheet_tab_name']
            output_json_file = semester['output_json_file']
            
            print(f"\n--- Processing Semester: {semester['display_title']} ---")
            sheet = client.open(google_sheet_name).worksheet(worksheet_name)
            all_values = sheet.get_all_values()

            if not all_values:
                print(f"[WARN] Worksheet '{worksheet_name}' is empty. Skipping.")
                continue

            header_row_index = -1
            for i, row in enumerate(all_values):
                if "COURSE" in row:
                    header_row_index = i
                    break
            
            if header_row_index == -1:
                print(f"[WARN] Could not find header row in '{worksheet_name}'. Skipping.")
                continue

            header = all_values[header_row_index]
            data_rows = all_values[header_row_index + 1:]
            df = pd.DataFrame(data_rows, columns=header)
            
            if 'COURSE' in df.columns:
                df.dropna(subset=['COURSE'], inplace=True)
                df = df[df['COURSE'] != '']
            else:
                print("[WARN] 'COURSE' column not found. Cannot clean empty rows.")
                continue

            schedule_data = process_sheet_data(df)
            with open(output_json_file, 'w') as f:
                json.dump(schedule_data, f, indent=4)
            print(f"[SUCCESS] Semester data saved to '{output_json_file}'.")
        except Exception as e:
            print(f"[ERROR] Could not process semester '{semester.get('display_title', 'N/A')}'. Reason: {e}")

# --- NEW FUNCTION ---
def convert_electives_sheet_to_json(client):
    """Reads the elective tracker sheet and generates electives.json."""
    ########## UPDATE THESE VALUES FOR YOUR SETUP ##########
    google_sheet_name = 'Teaching Assignments 2025-2026' # Or wherever your tracker is
    worksheet_name = 'Electives'
    output_json_file = 'electives.json'
    ########################################################
    try:
        print(f"\n--- Processing: Elective Tracker ---")
        print(f"[INFO] Reading data from Google Sheet: '{google_sheet_name}' (Worksheet: '{worksheet_name}')...")
        sheet = client.open(google_sheet_name).worksheet(worksheet_name)
        data = sheet.get_all_records()
        df = pd.DataFrame(data)

        # Basic logic for predicting next offering (can be expanded)
        # This is a placeholder; more complex logic can be added here
        df['Next Offering'] = df['Offering Frequency']

        df_final = df.fillna('')
        electives_data = df_final.to_dict(orient='records')
        with open(output_json_file, 'w') as f:
            json.dump(electives_data, f, indent=4)
        print(f"[SUCCESS] Elective tracker data saved to '{output_json_file}'.")
    except Exception as e:
        print(f"[ERROR] Could not process the elective tracker sheet. Reason: {e}")


def main():
    """Main function to authenticate and run all conversion tasks."""
    try:
        print("[INFO] Authenticating with Google Sheets API...")
        google_creds_json = os.environ['GCP_SA_KEY']
        google_creds_dict = json.loads(google_creds_json)
        scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
        creds = ServiceAccountCredentials.from_json_keyfile_dict(google_creds_dict, scope)
        client = gspread.authorize(creds)
        
        # Run both processes
        convert_all_semesters_to_json(client)
        convert_electives_sheet_to_json(client)

    except Exception as e:
        print(f"[FATAL] A critical error occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
