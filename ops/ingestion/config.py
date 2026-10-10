"""Read existing LXC settings without executing the legacy job or moving secrets."""
import ast
from pathlib import Path


def literal_settings(path, names):
    values = {}
    for node in ast.walk(ast.parse(Path(path).read_text())):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id in names:
                    try:
                        values[target.id] = ast.literal_eval(node.value)
                    except (ValueError, TypeError):
                        pass
    missing = names - values.keys()
    if missing:
        raise ValueError('Missing literal settings: ' + ', '.join(sorted(missing)))
    return values


def clients(repo, legacy):
    import gspread
    import httplib2
    from google.oauth2.service_account import Credentials
    from googleapiclient.discovery import build
    settings = literal_settings(legacy / 'cleanup-v4.py', {
        'GOOGLE_SHEET_URL', 'GOOGLE_SHEET_URL_NEW', 'SERVICE_ACCOUNT_FILE', 'SHEET_NAME'})
    key = literal_settings(legacy / 'get_ytb_data_v4.py', {'api_key'})['api_key']
    credentials = Credentials.from_service_account_file(
        str(repo / settings['SERVICE_ACCOUNT_FILE']),
        scopes=['https://www.googleapis.com/auth/spreadsheets'])
    sheets = gspread.authorize(credentials)
    sheets.set_timeout(30)
    worksheets = [sheets.open_by_url(settings[name]).worksheet(settings['SHEET_NAME'])
                  for name in ('GOOGLE_SHEET_URL', 'GOOGLE_SHEET_URL_NEW')]
    return build('youtube', 'v3', developerKey=key, cache_discovery=False,
                 http=httplib2.Http(timeout=30)), worksheets
