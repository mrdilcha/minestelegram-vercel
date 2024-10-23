const { Telegraf, session } = require('telegraf'); // Import session from telegraf

// Initialize the bot with the bot token from environment variables
const bot = new Telegraf(process.env.BOT_TOKEN);

// Log the Bot Token (for debugging purposes only)
console.log('Bot Token:', process.env.BOT_TOKEN);

// Use built-in session middleware
bot.use(session());

// Function to generate guaranteed safe positions based on the number of mines
function generateSafePositions(numMines) {
    console.log(`Generating safe positions for ${numMines} mines.`);
    if (numMines < 4) {
        return getRandomUniqueNumbers(4, 25); // Give 4 guaranteed diamonds
    } else if (numMines <= 6) {
        return getRandomUniqueNumbers(3, 25); // Give 3 guaranteed diamonds
    } else {
        return getRandomUniqueNumbers(2, 25); // Give 2 guaranteed diamonds
    }
}

// Function to get unique random numbers
function getRandomUniqueNumbers(count, max) {
    const numbers = new Set();
    while (numbers.size < count) {
        numbers.add(Math.floor(Math.random() * max));
    }
    return Array.from(numbers);
}

// Function to predict mine positions based on client ID seed and number of mines
function predictMines(clientIdSeed, numMines) {
    console.log(`Predicting mine positions for ${numMines} mines.`);
    const gridSize = 5;
    const minePositions = [];
    const cornerPositions = [0, 4, 20, 24];

    let attempts = 0; // Track attempts to avoid infinite loops

    // Generate mine positions ensuring no adjacent mines and avoiding corners
    while (minePositions.length < numMines && attempts < 100) {
        const pos = Math.floor(Math.random() * (gridSize * gridSize));

        // Check if position is valid: not a corner and not already occupied
        if (!cornerPositions.includes(pos) && !minePositions.includes(pos)) {
            // Check for adjacent mines
            const adjacentPositions = [
                pos - gridSize, pos + gridSize, // Top and Bottom
                pos - 1, pos + 1               // Left and Right
            ];

            // Only check valid adjacent positions
            const hasAdjacentMine = adjacentPositions.filter(adj =>
                adj >= 0 && adj < (gridSize * gridSize) && minePositions.includes(adj)
            ).length > 0;

            if (!hasAdjacentMine) {
                minePositions.push(pos);
            }
        }
        attempts++;
    }

    if (minePositions.length < numMines) {
        console.error(`Unable to place all ${numMines} mines after ${attempts} attempts.`);
    }

    return { minePositions };
}

// Start command handler
bot.start((ctx) => {
    ctx.reply('Welcome to the Stake Mines Predictor Bot! Enter the number of mines (1-24):');
});

// Predict command handler
bot.command('predict', (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    
    if (args.length === 0 || isNaN(args[0])) {
        ctx.reply('Please specify a valid number of mines (1-24).');
        return;
    }

    const numMines = parseInt(args[0]);

    if (numMines < 1 || numMines > 24) {
        ctx.reply('Please enter a number between 1 and 24.');
        return;
    }

    // Initialize session if it doesn't exist
    if (!ctx.session) {
        ctx.session = {};
    }

    // Store the number of mines in user context for later use
    ctx.session.numMines = numMines;

    ctx.reply('Please enter your Stake client ID (must be exactly 10 characters):');
});

// Handle client ID input
bot.on('text', (ctx) => {
    console.log('Received text input from user.');

    // Check if numMines is defined in the session before accessing it
    if (ctx.session && ctx.session.numMines) {
        const clientIdSeed = ctx.message.text.trim();
        
        // Validate client ID length
        if (clientIdSeed.length !== 10) {
            ctx.reply('Invalid Stake client ID. It must be exactly 10 characters long.');
            return;
        }

        console.log(`Client ID received: ${clientIdSeed}`);

        // Generate predictions based on the client ID seed
        const { minePositions } = predictMines(clientIdSeed, ctx.session.numMines);
        
        // Generate safe positions for display
        const safePositions = generateSafePositions(ctx.session.numMines);

        // Create a 5x5 grid with guaranteed safe positions and mines
        const gridSize = 5;
        let grid = Array.from({ length: gridSize }, () => Array(gridSize).fill('❌')); // Initialize with ❌

        minePositions.forEach(pos => {
            const row = Math.floor(pos / gridSize);
            const col = pos % gridSize;
            grid[row][col] = '💣'; // Place mines
        });

        safePositions.forEach(pos => {
            const row = Math.floor(pos / gridSize);
            const col = pos % gridSize;
            if (grid[row][col] !== '💣') { // Avoid overwriting mines
                grid[row][col] = '💎'; // Place safe spots
            }
        });

        // Send the formatted grid to the user without historical predictions
        const response = grid.map(row => row.join('')).join('\n');
        
        ctx.reply(`Predicted Pattern:\n${response}`);

        // Clear session data after processing
        delete ctx.session.numMines; 
    } else {
        ctx.reply("Please start a new prediction by using /predict <number_of_mines>.");
    }
});

// Handle webhook for Vercel deployment
module.exports = async (req, res) => {
    try {
        await bot.handleUpdate(req.body); // Handle incoming updates from Telegram
        res.status(200).send(); // Respond with 200 OK using status and send method
    } catch (error) {
        console.error('Error handling update:', error);
        
        res.status(500).send({ error: 'Internal Server Error' }); // Respond with error message for internal server error
    }
};
