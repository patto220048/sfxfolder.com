/**
 * RE-SRC Premiere ExtendScript - Paranoid Robustness Mode
 */

function getOrCreateBin(binName) {
    try {
        var root = app.project.rootItem;
        for (var i = 0; i < root.children.numItems; i++) {
            var item = root.children[i];
            if (item && item.type === 2 && item.name === binName) return item;
        }
        return root.createBin(binName);
    } catch(e) {
        return app.project.rootItem;
    }
}

function getSmartTrack(sequence, time, isAudio) {
    try {
        var tracks = isAudio ? sequence.audioTracks : sequence.videoTracks;
        if (!tracks || tracks.numItems === 0) {
            // Fallback: Nếu không tìm thấy loại track tương ứng, thử loại kia
            tracks = isAudio ? sequence.videoTracks : sequence.audioTracks;
        }
        if (!tracks || tracks.numItems === 0) return null;

        var playhead = time.seconds;
        var foundTrack = null;
        
        for (var i = 0; i < tracks.numItems; i++) {
            var track = null;
            try { track = tracks.item(i); } catch(e) { track = tracks[i]; }
            
            if (!track || track.locked) continue;

            var isOccupied = false;
            try {
                var clips = track.clips;
                if (clips && clips.numItems > 0) {
                    for (var j = 0; j < clips.numItems; j++) {
                        var clip = null;
                        try { clip = clips.item(j); } catch(e) { clip = clips[j]; }
                        
                        if (clip && clip.start && clip.end) {
                            if (playhead >= (clip.start.seconds - 0.05) && playhead < (clip.end.seconds + 0.05)) {
                                isOccupied = true;
                                break;
                            }
                        }
                    }
                }
            } catch(e) { isOccupied = false; }

            if (!isOccupied) {
                foundTrack = track;
                break;
            }
        }

        // Nếu tất cả bận, trả về track cuối cùng
        if (!foundTrack) {
            try { foundTrack = tracks.item(tracks.numItems - 1); } catch(e) { foundTrack = tracks[tracks.numItems - 1]; }
        }
        
        return foundTrack;
    } catch(e) {
        return null;
    }
}

function importToTimeline(filePath, displayName, fileFormat) {
    try {
        var project = app.project;
        if (!project) return "Error: No project open";
        var sequence = project.activeSequence;
        if (!sequence) return "Error: No active sequence found. Please click on your timeline.";

        var targetBin = getOrCreateBin("SFXFolder Assets");
        var importedItem = null;

        // 1. Tái sử dụng Asset
        if (displayName) {
            for (var i = 0; i < targetBin.children.numItems; i++) {
                var item = targetBin.children[i];
                if (item && item.name === displayName) {
                    importedItem = item;
                    break;
                }
            }
        }

        // 2. Import nếu chưa có
        if (!importedItem) {
            var success = project.importFiles([filePath], true, targetBin, false);
            if (!success) return "Error: Failed to import " + filePath;

            var diskFileName = filePath.split('/').pop();
            for (var j = 0; j < targetBin.children.numItems; j++) {
                var itemAfter = targetBin.children[j];
                if (itemAfter && itemAfter.name === diskFileName) {
                    importedItem = itemAfter;
                    if (displayName) importedItem.name = displayName;
                    break;
                }
            }
        }

        if (!importedItem) return "Error: Asset imported but not found in Project Panel";

        // 3. Quyết định loại Track
        var isAudio = true; // Mặc định là Audio nếu không rõ
        if (fileFormat) {
            var fmt = fileFormat.toLowerCase();
            var videoExts = ['mp4', 'mov', 'avi', 'mkv', 'mxf'];
            var isVideo = false;
            for (var v = 0; v < videoExts.length; v++) {
                if (fmt === videoExts[v]) { isVideo = true; break; }
            }
            if (isVideo) isAudio = false;
        }

        // 4. Chèn vào Timeline
        var time = sequence.getPlayerPosition();
        var targetTrack = getSmartTrack(sequence, time, isAudio);

        if (targetTrack) {
            targetTrack.overwriteClip(importedItem, time);
            var tName = "Timeline";
            try { tName = targetTrack.name; } catch(e) {}
            return "OK: Added to " + tName;
        }

        // Fallback cuối cùng: Thử track 0 của audio hoặc video bất kỳ
        try {
            var finalFallback = isAudio ? sequence.audioTracks[0] : sequence.videoTracks[0];
            if (finalFallback) {
                finalFallback.overwriteClip(importedItem, time);
                return "OK: Added to fallback track";
            }
        } catch(e) {}

        return "Error: Could not find any valid track to place the clip";
    } catch(err) {
        return "Critical Error: " + err.toString();
    }
}
