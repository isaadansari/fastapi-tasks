"""Classify a file by broad category, useful subcategory, and display type."""

from pathlib import Path

_SUBCATEGORY_EXTENSIONS: dict[str, dict[str, set[str]]] = {
    "Images": {
        "Photos": {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tif", ".tiff", ".heic"},
        "Vector graphics": {".svg", ".ai", ".eps"},
        "Design files": {".psd", ".sketch", ".fig"},
    },
    "Documents": {
        "PDFs": {".pdf"},
        "Text": {".txt", ".md", ".rtf"},
        "Word documents": {".doc", ".docx", ".odt"},
        "Spreadsheets": {".csv", ".xls", ".xlsx", ".ods"},
        "Presentations": {".ppt", ".pptx", ".odp"},
        "eBooks": {".epub", ".mobi"},
    },
    "Videos": {"Video": {".mp4", ".mkv", ".mov", ".avi", ".wmv", ".webm", ".m4v", ".mpeg", ".mpg"}},
    "Music": {"Audio": {".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".wma", ".aiff"}},
    "Archives": {
        "Compressed files": {".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz"},
        "Disk images": {".iso", ".img", ".dmg"},
    },
    "Code": {
        "Python": {".py", ".pyw", ".ipynb"},
        "JavaScript and TypeScript": {".js", ".jsx", ".ts", ".tsx"},
        "Web": {".html", ".htm", ".css", ".scss", ".vue", ".svelte"},
        "Configuration and data": {".json", ".yaml", ".yml", ".toml", ".xml", ".ini"},
        "Systems and applications": {".java", ".kt", ".c", ".cpp", ".h", ".cs", ".go", ".rs", ".php", ".sh"},
        "Database": {".sql"},
    },
}

_TYPE_LABELS = {
    ".7z": "7-Zip archive", ".ai": "Illustrator vector", ".csv": "CSV spreadsheet",
    ".doc": "Word document", ".docx": "Word document", ".epub": "EPUB eBook",
    ".fig": "Figma design", ".gif": "GIF image", ".heic": "HEIC image",
    ".html": "HTML document", ".ipynb": "Jupyter notebook", ".jpeg": "JPEG image",
    ".jpg": "JPEG image", ".js": "JavaScript file", ".json": "JSON data",
    ".md": "Markdown document", ".mkv": "MKV video", ".mp3": "MP3 audio",
    ".mp4": "MP4 video", ".pdf": "PDF document", ".png": "PNG image",
    ".ppt": "PowerPoint presentation", ".pptx": "PowerPoint presentation", ".py": "Python file",
    ".pyw": "Python file", ".rar": "RAR archive", ".rs": "Rust file",
    ".svg": "SVG image", ".tar": "TAR archive", ".toml": "TOML configuration",
    ".ts": "TypeScript file", ".tsx": "TypeScript React file", ".txt": "Text file",
    ".wav": "WAV audio", ".webm": "WebM video", ".webp": "WebP image",
    ".xls": "Excel spreadsheet", ".xlsx": "Excel spreadsheet", ".xml": "XML document",
    ".yaml": "YAML configuration", ".yml": "YAML configuration", ".zip": "ZIP archive",
}


def classify_file(path: Path) -> tuple[str, str, str]:
    """Return category, subcategory, and a readable extension type label."""
    extension = path.suffix.lower()
    for category, subcategories in _SUBCATEGORY_EXTENSIONS.items():
        for subcategory, extensions in subcategories.items():
            if extension in extensions:
                return category, subcategory, _TYPE_LABELS.get(extension, f"{extension[1:].upper()} file")
    if not extension:
        return "Other", "Uncategorized", "File without extension"
    return "Other", "Uncategorized", f"{extension[1:].upper()} file"
