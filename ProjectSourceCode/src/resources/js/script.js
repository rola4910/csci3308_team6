// used to change the color of the buttons in the playlists so users can select a bunch of songs
function colorChange(event, id) {
    let button = event.target; //get specific button that was clicked
    if (button.style.backgroundColor === "grey") {
        button.style.backgroundColor = "transparent"; // Reset to default
    } else {
        button.style.backgroundColor = "grey"; // Set to selected color
    }
    return id;
}

