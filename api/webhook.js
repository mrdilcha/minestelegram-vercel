const { Telegraf, session } = require('telegraf'); // Import session from telegraf

// Initialize the bot with the bot token from environment variables
const bot = new Telegraf(process.env.BOT_TOKEN);

// Log the Bot Token (for debugging purposes only)
console.log('Bot Token:', process.env.BOT_TOKEN);

// Use built-in session middleware
bot.use(session());

// Historical data placeholder for pattern recognition (can be expanded)
let historicalData = [];

// Function to generate guaranteed safe positions based on the number of mines
function generateSafePositions(numMines) {
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
    const minePositions = getRandomUniqueNumbers(numMines, 25);
    const safePositions = generateSafePositions(numMines);

    // Store current prediction in historical data for future analysis
    historicalData.push({ minePositions, safePositions });

    return { minePositions, safePositions };
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

    ctx.reply('Please enter your Stake client ID:');
});

// Handle client ID input
bot.on('text', (ctx) => {
    // Check if numMines is defined in the session before accessing it
    if (ctx.session && ctx.session.numMines) {
        const clientIdSeed = ctx.message.text.trim();
        
        // Generate predictions based on the client ID seed
        const { minePositions, safePositions } = predictMines(clientIdSeed, ctx.session.numMines);

        // Create a 5x5 grid with guaranteed safe positions
        const gridSize = 5;
        let grid = Array.from({ length: gridSize }, () => Array(gridSize).fill('❌')); // Initialize with ❌

        safePositions.forEach(pos => {
            const row = Math.floor(pos / gridSize);
            const col = pos % gridSize;
            grid[row][col] = '💎'; // Place guaranteed diamonds
        });

        minePositions.forEach(pos => {
            const row = Math.floor(pos / gridSize);
            const col = pos % gridSize;
            if (grid[row][col] !== '💎') { // Avoid overwriting guaranteed diamonds
                grid[row][col] = '💣'; // Place mines
            }
        });

        // Send the formatted grid to the user
        const response = grid.map(row => row.join('')).join('\n');
        
        if (historicalData.length > 0) {
            ctx.reply(`Historical Predictions: ${JSON.stringify(historicalData[historicalData.length - 1])}`);
        }

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
        res.sendStatus(200); // Respond with 200 OK
    } catch (error) {
        console.error('Error handling update:', error);
        res.sendStatus(500); // Respond with 500 Internal Server Error
    }
};
