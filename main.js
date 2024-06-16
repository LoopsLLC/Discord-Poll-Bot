const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Map();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    client.commands.set(command.data.name, command);
}

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
    if (interaction.isCommand()) {
        const command = client.commands.get(interaction.commandName);

        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    } else if (interaction.isModalSubmit()) {
        if (interaction.customId === 'pollModal') {
            const topic = interaction.fields.getTextInputValue('topicInput');
            const description = interaction.fields.getTextInputValue('descriptionInput');

            const pollData = {
                topic,
                description,
                status: 'Pending',
                createdAt: Date.now(),
                interactionId: interaction.id,
                messageId: null,
                upvotes: 0,
                downvotes: 0,
                voters: {}
            };

            savePollData(pollData);

            console.log(pollData);

            const embed = new EmbedBuilder()
                .setTitle(topic)
                .setDescription(`\`\`\`${description}\`\`\``)
                .addFields(
                    { name: 'Feedback', value: `\`\`\`👍 Upvotes: ${pollData.upvotes}\n👎 Downvotes: ${pollData.downvotes}\`\`\``, inline: true },
                    { name: 'Status', value: '```\nPending\n```', inline: true }
                )
                .setColor(config['embed-colour'])
                .setFooter({ text: config.footer });

            const upvoteButton = new ButtonBuilder()
                .setCustomId('upvote')
                .setLabel('👍')
                .setStyle(ButtonStyle.Success);

            const downvoteButton = new ButtonBuilder()
                .setCustomId('downvote')
                .setLabel('👎')
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder().addComponents(upvoteButton, downvoteButton);

            const reply = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

            // Save the message ID in poll data
            pollData.messageId = reply.id;
            savePollData(pollData, true);
        }
    } else if (interaction.isButton()) {
        const userId = interaction.user.id;
        const messageId = interaction.message.id;

        const pollData = getPollDataByMessageId(messageId);

        if (pollData) {
            let userVote = pollData.voters[userId];

            if (userVote && userVote === interaction.customId) {
                await interaction.reply({ content: 'You have already voted.', ephemeral: true });
                return;
            }

            if (interaction.customId === 'upvote') {
                if (userVote === 'downvote') {
                    pollData.downvotes -= 1;
                }
                pollData.upvotes += 1;
                pollData.voters[userId] = 'upvote';
            } else if (interaction.customId === 'downvote') {
                if (userVote === 'upvote') {
                    pollData.upvotes -= 1;
                }
                pollData.downvotes += 1;
                pollData.voters[userId] = 'downvote';
            }

            savePollData(pollData, true);

            const updatedEmbed = new EmbedBuilder()
                .setTitle(pollData.topic)
                .setDescription(`\`\`\`${pollData.description}\`\`\``)
                .addFields(
                    { name: 'Feedback', value: `\`\`\`👍 Upvotes: ${pollData.upvotes}\n👎 Downvotes: ${pollData.downvotes}\`\`\``, inline: true },
                    { name: 'Status', value: '```\nPending\n```', inline: true }
                )
                .setColor(config['embed-colour'])
                .setFooter({ text: config.footer });

            await interaction.update({ embeds: [updatedEmbed] });
        } else {
            console.error('Poll data not found for message ID:', messageId);
        }
    }
});

client.login(config.token);

const commands = Array.from(client.commands.values()).map(command => command.data.toJSON());
const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationGuildCommands(config.clientId, config.guildId),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();

function savePollData(pollData, update = false) {
    const filePath = path.join(__dirname, 'information.json');
    const fileData = fs.readFileSync(filePath, 'utf8');
    let data = [];

    if (fileData) {
        data = JSON.parse(fileData);
    }

    if (update) {
        const index = data.findIndex(p => p.interactionId === pollData.interactionId);
        if (index !== -1) {
            data[index] = pollData;
        }
    } else {
        data.push(pollData);
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function getPollDataByMessageId(messageId) {
    const filePath = path.join(__dirname, 'information.json');
    const fileData = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileData);

    return data.find(p => p.messageId === messageId);
}
