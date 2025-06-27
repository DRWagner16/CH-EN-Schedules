# In convert_excel.py

import pandas as pd
import json
import gspread
from oauth2client.service_account import ServiceAccountCredentials
from datetime import datetime
import os
import sys # <-- This import statement was missing

def calculate_duration(time_str):
    """Calculates the duration of a class in minutes from a time string."""
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

def process_sheet_data(df):
    """A helper function to process a DataFrame into the final format."""
    print("[INFO] Setting course number...")
    # Ensure COURSE column exists before trying to access it
    if 'COURSE' in df.columns:
        df['course_number'] = df['COURSE'].astype(str)
    else:
        # If there's no COURSE column, create an empty one to prevent errors
        df['course_number'] = ''

    print("[INFO] Calculating class durations...")
    df['duration'] = df['TIME'].apply(calculate_duration)
    print("[INFO] Identifying and cleaning up unscheduled courses...")
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

def convert_all_semesters_to_json():
    """
    Reads config.json, loops through all semesters, and generates a JSON file for each.
    """
    try:
        print("[INFO] Reading config.json...")
        with open('config.json', 'r') as f:
            config = json.load(f)

        print("[INFO] Authenticating with Google Sheets API...")
        google_creds_json = os.environ['GCP_SA_KEY']
        google_creds_dict = json.loads(google_creds_json)
        scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
        creds = ServiceAccountCredentials.from_json_keyfile_dict(google_creds_dict, scope)
        client = gspread.authorize(creds)

        # Loop through each semester defined in the config file
        for semester in config['semesters']:
            google_sheet_name = semester['google_sheet_file_name']
            worksheet_name = semester['worksheet_tab_name']
            output_json_file = semester['output_json_file']
            
            print(f"\n--- Processing: {semester['display_title']} ---")
            print(f"[INFO] Reading data from Google Sheet: '{google_sheet_name}' (Worksheet: '{worksheet_name}')...")
            
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
                print(f"[WARN] Could not find header row containing 'COURSE' in '{worksheet_name}'. Skipping.")
                continue

            header = all_values[header_row_index]
            data_rows = all_values[header_row_index + 1:]
            df = pd.DataFrame(data_rows, columns=header)
            
            # Check for COURSE column before trying to drop NA values from it
            if 'COURSE' in df.columns:
                df.dropna(subset=['COURSE'], inplace=True)
                df = df[df['COURSE'] != '']
            else:
                print("[WARN] 'COURSE' column not found after DataFrame creation. Cannot clean empty rows.")
                continue

            # Process the data and convert to JSON
            schedule_data = process_sheet_data(df)
            
            with open(output_json_file, 'w') as f:
                json.dump(schedule_data, f, indent=4)
            
            print(f"[SUCCESS] Data for {semester['display_title']} saved to '{output_json_file}'.")

    except Exception as e:
        print(f"[FATAL] An unexpected error occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    convert_all_semesters_to_json()
