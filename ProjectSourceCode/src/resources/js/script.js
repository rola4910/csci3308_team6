// used to change the color of the buttons in the playlists so users can select a bunch of songs
function colorChange(event) {    
    let button = event.target; // Get the specific button that was clicked
    if (button.style.backgroundColor === "grey") {
        button.style.backgroundColor = "transparent"; // Reset to default
    } else {
        button.style.backgroundColor = "grey"; // Set to selected color
    }
}

function selectedPlaylist(id) {
    console.log("Selected Playlist ID (Client):", id);
    window.location.href = `/makePlaylist?id=${id}`;
}