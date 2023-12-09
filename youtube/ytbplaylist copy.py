from googleapiclient.discovery import build
import datetime

def get_video_details(video_id, youtube):
    # Fetching video details
    video_request = youtube.videos().list(
        part="snippet,statistics",
        id=video_id
    )
    video_response = video_request.execute()

    if video_response['items']:
        video_info = video_response['items'][0]
        channel_title = video_info['snippet']['channelTitle']
        view_count = video_info['statistics'].get('viewCount', 'N/A')
        return channel_title, view_count
    return "N/A", "N/A"

def get_playlist_videos(playlist_id, api_key):
    youtube = build('youtube', 'v3', developerKey=api_key)

    request = youtube.playlistItems().list(
        part='snippet',
        playlistId=playlist_id,
        maxResults=50
    )

    videos = []
    while request is not None:
        response = request.execute()
        for item in response['items']:
            video_id = item['snippet']['resourceId']['videoId']
            title = item['snippet']['title']
            published_at = item['snippet']['publishedAt']
            year = datetime.datetime.fromisoformat(published_at[:-1]).year
            month = datetime.datetime.fromisoformat(published_at[:-1]).month
            day = datetime.datetime.fromisoformat(published_at[:-1]).day

            channel_title, view_count = get_video_details(video_id, youtube)
            videos.append(f"{title} Uploaded:{year}-{month}-{day} Views:{view_count}")
        request = youtube.playlistItems().list_next(request, response)

    return videos


# Replace with your API key and playlist ID
api_key = 'your api key'
playlist_id_dltlly = 'PLXpSN5kwAmcgB3KMBUCHtLC-SGwdF2xMa' #dlttly
playlist_id_fob = 'PLlYYj-TzOlFko09dyz1xsfLtvZdwxKPfK' # future of battlerap
video_titles_dltlly = get_playlist_videos(playlist_id_dltlly, api_key)
video_titles_fob = get_playlist_videos(playlist_id_fob, api_key)

# Get current date
current_date = datetime.datetime.now().strftime("%d_%m_%Y")

# Saving the titles in a file
filename = f"dltlly_fob_all.txt"
with open(filename, 'w') as file:
    for title in video_titles_dltlly:
        file.write(title + '\n')
    for title in video_titles_fob:
        file.write(title + '\n')

print(f"Titles saved in {filename}")