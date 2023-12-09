import pandas as pd
import time  
import re
import os
import datetime


timestamp = str(time.time())
print("Timestamp:", timestamp)

# Regular expression to find years between 2012 and 2023
year_pattern = re.compile(r'\b(2012|2013|2014|2015|2016|2017|2018|2019|2020|2021|2022|2023|2024|2025)\b')
# Regular expression to find league names, first takes prio
league_pattern = re.compile(r'\b(DLTLLY|D&DL|Dont Flop|Don\'t Flop|DLTLLY x ABC|BRB|FOB|SPOX)\b', re.IGNORECASE)

# Regular expression to find uploaded dates in the format "uploaded:YYYY-MM-DD"
date_pattern = re.compile(r'Uploaded:(\d{4}-\d{1,2}-\d{1,2})')

# Regular expression to find views
views_pattern = re.compile(r'Views:\s*(\d+)')

# Regular expression to find channel
# channel_pattern = re.compile(r'\b(Future of Battlerap|Spox|Don\'t Let The Label Label You!)\b', re.IGNORECASE)

# Path to your text file
input_file_path = 'dltlly_fob_all.txt'
#input_file_path = 'testing.txt'
non_match_file_path = 'non_match.txt'

corrected_data = []
seen_keys = set()  # Set to keep track of seen keys


with open(input_file_path, 'r') as file, open(non_match_file_path, 'w') as non_match_file:
    for original_line in file:
        line = original_line.strip().lower()  # Convert to lowercase for comparison
        original_line = original_line.strip()  # Preserve the original line for data extraction

        # Extract year using regular expression
        year_match = year_pattern.search(original_line)
        year = year_match.group() if year_match else "Unknown"

        # Extract league using regular expression
        league_match = league_pattern.search(original_line)
        league = league_match.group() if league_match else "Unknown"

        # Check for different delimiters
        if " // " in line:
            delimiter = " // "
        elif " | " in line:
            delimiter = " | "
        elif " ⎪ " in line:
            delimiter = " ⎪ "
        elif "⎪" in line:  # Added this condition for "|" without spaces
            delimiter = "⎪"
        else:
            delimiter = None

        if line and delimiter:
            parts = original_line.split(delimiter)
            if len(parts) >= 3:
                # Case-insensitive split for names
                names = re.split(r' vs\.? ', parts[0], flags=re.IGNORECASE)
                if len(names) == 2:  # Check if there are exactly two names
                    event_with_city = parts[1].strip()

                    # Extract uploaded date and views from the last part of the line
                    additional_info = parts[-1]  # This should contain uploaded date and views
                    date_match = date_pattern.search(additional_info)
                    uploaded_date = date_match.group(1) if date_match else "Unknown"

                    views_match = views_pattern.search(additional_info)
                    views = views_match.group(1) if views_match else "Unknown"

                    # Clean up the Event field
                    event_with_city = parts[1].strip()
                    # Remove league names
                    event_with_city = re.sub(r'\b(DLTLLY|Dont Flop|BRB|FOB|Sport-Rap-Battle])\b', '', event_with_city, flags=re.IGNORECASE)
                    # Remove event types
                    event_with_city = event_with_city.replace("On Beat", "").replace("On-Beat", "").replace("Rap Battle", "").replace("RapBattle", "").replace("Rapbattle","").replace("OnBeatBattle", "").replace("RapBattles", "").replace("RapbattleStellwerk", "Stellwerk")
                    # Remove ' @ '
                    event_with_city = event_with_city.replace(" @ ", "").replace("@","").replace("(", "").replace(")", "").replace("|", "")
                    # Check if event_with_city is empty or NaN
                    if pd.isna(event_with_city) or event_with_city == " ":
                        event_with_city = "mayneedmanualfix"

                    # Check if event_with_city is empty after cleaning and use 'Unknown' if it is
                    event_with_city = event_with_city if event_with_city else "mayneedmanualfix"

                    # Determine the type based on the presence of "On Beat", "Onbeat", or "On-Beat" in the entire line
                    event_type = "On Beat" if "on beat" in line or "onbeat" in line or "on-beat" in line else "Accapella"

                    # Extract uploaded date using regular expression
                    date_match = date_pattern.search(original_line)
                    uploaded_date = date_match.group(1) if date_match else "mayneedmanualfix"

                    # Extract views using regular expression
                    views_match = views_pattern.search(original_line)
                    views = views_match.group(1) if views_match else "Unknown"

                    # Extract channel using regular expression
                    #channel_match = channel_pattern.search(original_line)
                    #channel = channel_match.group() if channel_match else "Unknown"

                    # Create a key for duplicate checking (excluding the 'uploaded:' part)
                    key_for_duplicate_check = original_line.split('Uploaded:')[0].strip()

                    if key_for_duplicate_check not in seen_keys:
                        seen_keys.add(key_for_duplicate_check)

                        corrected_data.append({
                            "Name #1": names[0].strip(),
                            "Name #2": names[1].strip(),
                            "Event": event_with_city.strip(),
                            "Type": event_type,
                            "Year": year.strip(),
                            "League": league,  # Add league information
                            "Uploaded": uploaded_date,  # Add uploaded date information
                            "Views": views,  # Add views information
                            #"Channel": channel  # Add channel information
                        })
                    else:
                        print(f"Duplicate line found and skipped: {original_line}")
                        #pass
                else:
                    non_match_file.write(original_line + '\n')
                    #print(f"Line does not have exactly two names, names length is {str(len(names))} og line: {original_line}")
            else:
                non_match_file.write(original_line + '\n')
                #print(f"Line does not match expected format or is empty: {original_line}")
        else:
            non_match_file.write(original_line + '\n')
            #print(f"Line does not match expected format or is empty: {original_line}")



# Creating a DataFrame from the corrected data
df_corrected = pd.DataFrame(corrected_data)

# Identifying duplicate rows (keeping the first occurrence)
duplicates = df_corrected[df_corrected.duplicated(keep='first')]

# Check if there are any duplicates and print them
if not duplicates.empty:
    print("Duplicate rows (excluding the first occurrence):")
    print(duplicates)

# Removing duplicate rows
df_corrected.drop_duplicates(inplace=True)

# Define file paths
input_file_path = 'dltlly_fob_all.txt'
output_file_path = os.path.join('website', 'battle_events.csv')

# Check if the output file already exists and read it
if os.path.exists(output_file_path):
    df_existing = pd.read_csv(output_file_path)
    # Convert 'Year' to string if it exists
    if 'Year' in df_existing.columns:
        df_existing['Year'] = df_existing['Year'].astype(str)
else:
    df_existing = pd.DataFrame()
# Compare new data with existing data
if not df_existing.empty:
    comparison_columns = ['Name #1','Uploaded']

    # Convert all comparison columns to string for both DataFrames
    for col in comparison_columns:
        df_existing[col] = df_existing[col].astype(str)
        df_corrected[col] = df_corrected[col].astype(str)

    # Add an identifier column to df_corrected
    df_corrected['identifier'] = df_corrected.index

    # Merge with an indicator to find out the source of each row
    merged_df = pd.merge(df_existing, df_corrected[comparison_columns + ['identifier']], 
                         on=comparison_columns, how='outer', indicator=True)

    # Filter out the rows that are only in the new data (df_corrected)
    new_identifiers = merged_df[merged_df['_merge'] == 'right_only']['identifier']

    if not new_identifiers.empty:
        print("Changes detected (new rows to be added):")
        print(df_corrected.loc[new_identifiers])

    # Merge the existing data with the new data
    df_merged = pd.concat([df_existing, df_corrected.loc[new_identifiers]]).drop_duplicates(subset=comparison_columns, keep='first')
else:
    df_merged = df_corrected

# Drop the identifier column
df_merged.drop(columns=['identifier'], inplace=True, errors='ignore')

# Saving the merged DataFrame to a CSV file
df_merged.to_csv(output_file_path, index=False)
print(f"CSV file saved at: {output_file_path}")