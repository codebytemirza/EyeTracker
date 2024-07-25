const { Client, GatewayIntentBits, MessageAttachment } = require('discord.js');
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');
require('dotenv').config(); // Ensure .env file is loaded

const app = express();
app.use(bodyParser.json());

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const SERVER_PORT = process.env.PORT || 3000;
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

let captureRequest = null;

// Discord Bot
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.once('ready', () => {
    console.log('Bot is online!');
});

client.on('messageCreate', async (message) => {
    if (message.content === '/capture') {
        try {
            // Request capture from the server
            const response = await axios.post(`${SERVER_URL}/capture`, { user_id: message.author.id });
            if (response.status === 200) {
                message.channel.send('Capturing image...');
                // Wait for a moment for the server to process the request
                setTimeout(async () => {
                    try {
                        const imageResponse = await axios.get(`${SERVER_URL}/capture`, { responseType: 'arraybuffer' });
                        const imageBuffer = Buffer.from(imageResponse.data, 'binary');
                        const attachment = new MessageAttachment(imageBuffer, 'capture.jpg');
                        message.channel.send({ files: [attachment] });
                    } catch (error) {
                        console.error(error);
                        message.channel.send('Error occurred while retrieving the image.');
                    }
                }, 5000); // Wait 5 seconds for image capture
            } else {
                message.channel.send('Failed to capture image.');
            }
        } catch (error) {
            console.error(error);
            message.channel.send('Error occurred while capturing image.');
        }
    }
});

client.login(DISCORD_BOT_TOKEN);

// Express Server
app.post('/capture', (req, res) => {
    const { user_id, imageBase64 } = req.body;
    if (!user_id || !imageBase64) {
        return res.status(400).send('Missing parameters');
    }

    console.log(`Received capture request for user: ${user_id}`);

    // Relay image directly to Discord
    try {
        const imageBuffer = Buffer.from(imageBase64, 'base64');
        client.channels.fetch(process.env.DISCORD_CHANNEL_ID).then(channel => {
            const attachment = new MessageAttachment(imageBuffer, 'capture.jpg');
            channel.send({ content: `Captured image for user: ${user_id}`, files: [attachment] })
                .then(() => {
                    console.log(`Sent image for user: ${user_id}`);
                    res.sendStatus(200);
                })
                .catch(error => {
                    console.error(error);
                    res.status(500).send('Failed to send image');
                });
        }).catch(error => {
            console.error(error);
            res.status(500).send('Failed to fetch channel');
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error occurred while processing the image');
    }
});

app.listen(SERVER_PORT, () => {
    console.log(`Server is running on port ${SERVER_PORT}`);
});
