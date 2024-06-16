const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('approve')
        .setDescription('Approve a poll')
        .addStringOption(option =>
            option.setName('message_id')
                .setDescription('The message ID of the poll')
                .setRequired(true)
        ),
    async execute(interaction) {
        if (interaction.user.id !== config.ownerId) {
            await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
            return;
        }

        const messageId = interaction.options.getString('message_id');

        const pollData = getPollDataByMessageId(messageId);
        if (!pollData) {
            await interaction.reply({ content: 'Poll data not found for the provided message ID.', ephemeral: true });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle(pollData.topic)
            .setDescription(`\`\`\`${pollData.description}\`\`\``)
            .addFields(
                { name: 'Feedback', value: `\`\`\`👍 Upvotes: ${pollData.upvotes}\n👎 Downvotes: ${pollData.downvotes}\`\`\``, inline: true },
                { name: 'Status', value: '```\n✅ Approved\n```', inline: true }
            )
            .setColor(config['embed-approve-colour'])
            .setFooter({ text: config.footer });

        pollData.status = 'Approved';
        savePollData(pollData, true);

        const message = await interaction.channel.messages.fetch(messageId);
        await message.edit({ embeds: [embed], components: [] });

        await interaction.reply({ content: `Poll status has been updated to ${pollData.status}.`, ephemeral: true });
    }
};

function savePollData(pollData, update = false) {
    const filePath = path.join(__dirname, '../information.json');
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
    const filePath = path.join(__dirname, '../information.json');
    const fileData = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileData);

    return data.find(p => p.messageId === messageId);
}
