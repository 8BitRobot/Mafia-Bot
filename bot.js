const Discord = require("discord.js");
const client = new Discord.Client();
const config = require("./config.json");
const fs = require("fs");

const prefix = "m.";

class GameData {
    constructor() {
        this.players = new Map();
        this.userids = new Map();
        this.settings = new Map();
        this.gameActive = false
        this.mafiaRoles = [
            {
                name: "Godfather",
                align: "Mafia",
                night: function (player) {}
            },
            {
                name: "Framer",
                align: "Mafia",
                night: function (player) {},
            },
            {
                name: "Silencer",
                align: "Mafia",
                night: function (player) {},
            },
            {
                name: "Mafioso",
                align: "Mafia",
                night: function (player) {}
            }
        ]

        this.villageRoles = [
            {
                name: "Doctor",
                align: "Village",
                night: function (player) {},
            },
            {
                name: "Detective",
                align: "Village",
                night: function (player) {}
            },
            {
                name: "Vigilante",
                align: "Village",
                night: function (player) {}
            },
            {
                name: "Mayor",
                align: "Village",
                night: function (player) {},
            },
        ];      
        
        this.neutralRoles = [
            {
                name: "Executioner",
                align: "Neutral",
                night: function (player) {}
            },
            {
                name: "Jester",
                align: "Neutral",
                night: function (player) {}
            },
            {
                name: "Eternal",
                align: "Neutral",
                night: function (player) {}
            }
        ]
    };
}

let gamedata = new GameData();

client.once("ready", () => {
    console.log("Ready!");
});

client.login(config.token);

client.commands = new Discord.Collection();

const commandFiles = fs.readdirSync("./commands").filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.name, command);
}

client.on("message", (message) => {
    if (!message.content.startsWith(prefix) || message.author.bot) {
        return;
    }
    if (message.content.startsWith(prefix)) {
        let args = message.content.substring(prefix.length).trim().split(/ +/);
        let command = args.shift().toLowerCase();
        try {
            client.commands.get(command).execute(message, args, gamedata);
        } catch (error) {
            console.error(error);
            message.channel.send("There was an error. The command didn't work.");
        }
    }
});