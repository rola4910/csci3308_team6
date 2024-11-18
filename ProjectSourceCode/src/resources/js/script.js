// used to change the color of the buttons in the playlists so users can select a bunch of songs
function colorChange(event) {
    let button = event.target; // Get the specific button that was clicked
    if (button.style.backgroundColor === "grey") {
        button.style.backgroundColor = "transparent"; // Reset to default
    } else {
        button.style.backgroundColor = "grey"; // Set to selected color
    }
}

// FIXME: broken still working on it
// function setDraftPlaylistName(event) {
//     console.log('TEST');
//     const input = document.getElementById('playlist-name');
//     const title = document.getElementById('playlist-title');

//     console.log('input:', input);
//     console.log('title:', title);

//     // Get the input value
//     const playlistName = input.value.trim();
//     console.log('playlist name:', playlistName);
//     if (playlistName) {
//         // Hide the input field and show the title with the entered name
//         input.classList.add('d-none');
//         title.classList.remove('d-none');
//         title.textContent = playlistName;
//     }

// }