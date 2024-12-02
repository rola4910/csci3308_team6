# csci3308_team6


Brief Application Description:
- Fix Your Mix is an application designed for Spotify users looking for a more personalized, enhanced experience and offers greater functionality for playlists. With Fix Your Mix, users can create, edit, and sort playlists with greater ease and export the modified playlist back into Spotify or share with other users. A dynamic visualizer is included when users preview songs. The final feature is a concert listing that will show what artists in a playlist have upcoming concerts near the user for a specified location. 
When sorting through playlists, users will be able to sort by categories such as decades, release date, date added to playlist, or alphabetically by artists or songs. Enhanced editing tools allow users to mass delete or add songs through filters including artist, date released, date added, and song genre. The visualizer will respond to the frequency, intensity, and rhythm of the music and aims to enhance the user experience while listening to songs.


Contributors:
- Bobby Lashway
- Parker Secrest
- Evan Pradhan
- Andy Nguyen
- Mary Ella Rinzler


Technology Stack Used:
- Javascript
- Handlebars.js
- Postgres SQL
- HTML/CSS
- Chai/Mocha testing
- Render hostings


Prerequisites to Run the Application:
- Have an existing Spotify account
- Docker installed


Instructions on how to run the application locally:
- clone the repository and cd into ProjectSourceCode
- run `docker-compose down -v ; docker-compose up -d` in a Powershell terminal
- view docker logs to see when the connection to port 3000 is successful and the app can be viewed
- when done, navigate to localhost:3000 in a web browser to view the application


How to run the tests:
- In the docker-compose.yaml, change the web command to be `npm run testandrun` instead of `npm start`
- run the app like normal and view the logs to see passing and failing tests
  

Link to the deployed application:
- https://csci3308-team6.onrender.com/


Relase Notes:
 - Added getUserPlaylist functionality
 - User sessions now store tokens
 - Added background token refresh functionality
 - Added login page with link to spotify auth
 - Updated dropdown
