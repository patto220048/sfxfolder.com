/**
 * RE-SRC Premiere ExtendScript
 */

function importToTimeline(filePath) {
    var project = app.project;
    if (!project) return "No project open";

    var activeSequence = project.activeSequence;
    if (!activeSequence) return "No active sequence";

    // 1. Import file vào project
    // Premiere yêu cầu path tuyệt đối và file phải tồn tại trên ổ cứng
    var fileToImport = [filePath];
    
    // ImportFiles(paths, suppressUI, targetBin, importAsNumberedStills)
    // Trả về true nếu thành công
    var success = project.importFiles(fileToImport, true, project.rootItem, false);

    if (!success) return "Import failed at project level";

    // 2. Tìm item vừa import để đưa vào timeline
    // Chúng ta lấy tên file từ đường dẫn để tìm
    var fileName = filePath.split('/').pop(); 
    var importedItem = null;
    
    // Duyệt qua các item trong project panel
    for (var i = 0; i < project.rootItem.children.numItems; i++) {
        var item = project.rootItem.children[i];
        if (item.name === fileName) {
            importedItem = item;
            break;
        }
    }

    // 3. Chèn vào Timeline tại vị trí Playhead
    if (importedItem) {
        var videoTrack = activeSequence.videoTracks[0]; // Mặc định track 1
        var time = activeSequence.getPlayerPosition(); // Lấy vị trí con trỏ hiện tại
        
        // insertClip(projectItem, timeInTicks)
        videoTrack.insertClip(importedItem, time);
        return "Successfully added to timeline: " + fileName;
    }

    return "Error: Could not find imported item in Project panel";
}
