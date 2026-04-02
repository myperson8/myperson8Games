import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

const DEFAULT_GAMES = [
  {
    id: '100001',
    title: 'Neon Runner',
    description: 'A fast-paced endless runner in a neon-lit cyber world. Dodge obstacles and collect power-ups to achieve the high score.',
    category: 'Action',
    thumbnailUrl: 'https://picsum.photos/seed/neon/800/600',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-a-futuristic-city-4412-large.mp4',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { margin: 0; background: #000; color: #0f0; font-family: monospace; overflow: hidden; display: flex; align-items: center; justify-content: center; height: 100vh; }
          #game { border: 2px solid #0f0; width: 400px; height: 300px; position: relative; }
          #player { width: 20px; height: 20px; background: #0f0; position: absolute; bottom: 20px; left: 50px; }
          .obstacle { width: 20px; height: 20px; background: #f00; position: absolute; bottom: 20px; }
          #score { position: absolute; top: 10px; left: 10px; }
        </style>
      </head>
      <body>
        <div id="game">
          <div id="score">Score: 0</div>
          <div id="player"></div>
        </div>
        <script>
          const player = document.getElementById('player');
          const game = document.getElementById('game');
          const scoreEl = document.getElementById('score');
          let score = 0;
          let isJumping = false;
          let playerY = 20;

          document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !isJumping) {
              isJumping = true;
              let jumpHeight = 0;
              const jumpInterval = setInterval(() => {
                if (jumpHeight < 100) {
                  jumpHeight += 5;
                  playerY += 5;
                } else {
                  clearInterval(jumpInterval);
                  const fallInterval = setInterval(() => {
                    if (jumpHeight > 0) {
                      jumpHeight -= 5;
                      playerY -= 5;
                    } else {
                      clearInterval(fallInterval);
                      isJumping = false;
                    }
                    player.style.bottom = playerY + 'px';
                  }, 20);
                }
                player.style.bottom = playerY + 'px';
              }, 20);
            }
          });

          function createObstacle() {
            const obstacle = document.createElement('div');
            obstacle.className = 'obstacle';
            obstacle.style.right = '-20px';
            game.appendChild(obstacle);
            let pos = -20;
            const interval = setInterval(() => {
              pos += 5;
              obstacle.style.right = pos + 'px';
              if (pos > 400) {
                clearInterval(interval);
                game.removeChild(obstacle);
                score++;
                scoreEl.innerText = 'Score: ' + score;
              }
              const pRect = player.getBoundingClientRect();
              const oRect = obstacle.getBoundingClientRect();
              if (pRect.left < oRect.right && pRect.right > oRect.left && pRect.top < oRect.bottom && pRect.bottom > oRect.top) {
                alert('Game Over! Score: ' + score);
                score = 0;
                scoreEl.innerText = 'Score: 0';
                pos = 500;
              }
            }, 20);
          }
          setInterval(createObstacle, 2000);
        </script>
      </body>
      </html>
    `,
    authorId: 'system',
    authorName: 'System',
    isPublic: true,
    playCount: 1250,
    likes: 450,
    dislikes: 12,
    avgRating: 4.8,
    ratingCount: 85,
    createdAt: new Date()
  },
  {
    id: '100002',
    title: 'Cyber Puzzle',
    description: 'Solve complex logic puzzles in a futuristic interface. Each level tests your spatial reasoning and pattern recognition.',
    category: 'Puzzle',
    thumbnailUrl: 'https://picsum.photos/seed/puzzle/800/600',
    htmlContent: '<html><body style="background:#111;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><h1>Cyber Puzzle Coming Soon</h1></body></html>',
    authorId: 'system',
    authorName: 'System',
    isPublic: true,
    playCount: 850,
    likes: 210,
    dislikes: 5,
    avgRating: 4.5,
    ratingCount: 42,
    createdAt: new Date()
  }
];

export async function seedDefaultGames() {
  console.log('Seeding default games...');
  for (const game of DEFAULT_GAMES) {
    const gameRef = doc(db, 'games', game.id);
    await setDoc(gameRef, {
      ...game,
      createdAt: serverTimestamp()
    }, { merge: true });
  }
  console.log('Seeding complete!');
}
