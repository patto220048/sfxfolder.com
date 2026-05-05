/**
 * RE-SRC Premiere ExtendScript
 */

function importToTimeline(filePath, displayName) {
    var project = app.project;
    if (!project) return "No project open";

    var activeSequence = project.activeSequence;
    if (!activeSequence) return "No active sequence";

    // 1. Import file vào project
    var fileToImport = [filePath];
    var success = project.importFiles(fileToImport, true, project.rootItem, false);

    if (!success) return "Import failed";

    // 2. Tìm item vừa import để đổi tên và đưa vào timeline
    // Khi import file .dat, tên mặc định sẽ là tên file trên đĩa
    var diskFileName = filePath.split('/').pop(); 
    var importedItem = null;
    
    for (var i = 0; i < project.rootItem.children.numItems; i++) {
        var item = project.rootItem.children[i];
        if (item.name === diskFileName) {
            importedItem = item;
            break;
        }
    }

    // 3. Đổi tên hiển thị và chèn vào Timeline
    if (importedItem) {
        if (displayName) {
            importedItem.name = displayName; // Đổi tên hiển thị cho đẹp
        }
        
        var videoTrack = activeSequence.videoTracks[0]; 
        var time = activeSequence.getPlayerPosition(); 
        videoTrack.insertClip(importedItem, time);
        return "Successfully added: " + (displayName || diskFileName);
    }

    return "Error: Could not find imported item in Project panel";
}
