"""File category, subcategory, and extension-label rules."""

CATEGORY_TYPES: dict[str, dict[str, set[str]]] = {
    "Images": {
        "Photos": {".jpg", ".jpeg", ".heic", ".heif"},
        "Graphics": {".png", ".gif", ".bmp", ".webp", ".svg", ".tif", ".tiff", ".ico", ".psd", ".ai", ".eps"},
        "Camera RAW": {".cr2", ".cr3", ".nef", ".arw", ".dng", ".raf", ".orf", ".rw2"},
    },
    "Documents": {
        "PDFs": {".pdf"},
        "Text & Notes": {".txt", ".md", ".rtf", ".log"},
        "Word Documents": {".doc", ".docx", ".odt"},
        "Spreadsheets": {".csv", ".xls", ".xlsx", ".ods"},
        "Presentations": {".ppt", ".pptx", ".odp"},
        "Ebooks": {".epub", ".mobi", ".azw", ".azw3"},
    },
    "Videos": {
        "Movies": {".mp4", ".mkv", ".mov", ".avi", ".wmv", ".webm", ".m4v", ".mpeg", ".mpg"},
        "Video Projects": {".prproj", ".drp", ".imov"},
    },
    "Music": {
        "Compressed Audio": {".mp3", ".aac", ".ogg", ".m4a", ".wma"},
        "Lossless Audio": {".wav", ".flac", ".aiff", ".alac"},
        "Playlists": {".m3u", ".m3u8", ".pls"},
    },
    "Archives": {
        "Compressed Folders": {".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz"},
        "Disk Images": {".iso", ".dmg", ".img"},
    },
    "Code": {
        "Python": {".py", ".pyw", ".ipynb"},
        "JavaScript & TypeScript": {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"},
        "Web": {".html", ".htm", ".css", ".scss", ".sass", ".vue", ".svelte"},
        "Systems Languages": {".c", ".cpp", ".h", ".hpp", ".cs", ".go", ".rs", ".java", ".kt"},
        "Data & Config": {".json", ".yaml", ".yml", ".toml", ".xml", ".ini", ".sql"},
        "Scripts": {".sh", ".ps1", ".bat", ".cmd", ".php", ".rb"},
    },
    "Applications": {
        "Installers": {".exe", ".msi", ".appx", ".deb", ".rpm", ".pkg"},
        "Mobile Apps": {".apk", ".ipa"},
    },
    "Fonts": {"Font Files": {".ttf", ".otf", ".woff", ".woff2"}},
    "3D & CAD": {
        "3D Models": {".obj", ".stl", ".fbx", ".blend", ".gltf", ".glb"},
        "CAD Drawings": {".dwg", ".dxf", ".step", ".stp", ".iges"},
    },
}


def classify_file(extension: str) -> tuple[str, str, str]:
    """Return category, subcategory, and a short visible file-type label."""
    normalized_extension = extension.lower()
    type_label = normalized_extension.lstrip(".").upper() or "NO EXTENSION"
    for category, subcategories in CATEGORY_TYPES.items():
        for subcategory, extensions in subcategories.items():
            if normalized_extension in extensions:
                return category, subcategory, type_label
    return "Other", "Uncategorized", type_label
