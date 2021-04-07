const fs = require('fs')

module.exports = {
    name: "vc",
    description: "",
    async execute(message, args, gamedata) {
        var user = message.author;
        let voiceChannel;
        for (let [_, channel] of message.guild.channels.cache) {
            if (Array.from(channel.members.values()).map(u => u.id).includes(user.id) && channel.type === "voice") {
                voiceChannel = message.guild.channels.resolve(channel.id);
                console.log(voiceChannel)
                voiceChannel.join().then((con) => {
                    let streams = []
                    for (let member of Array.from(con.channel.members.values())) {
                        if (!member.user.bot) {
                            var stream = con.receiver.createStream(member.id, {end: 'manual', type: "opus"});
                            console.log(stream);
                            streams.push(stream);
                        }
                    }
                    gamedata.settings.get("emit").emit("stream", streams);
                })
            }
        }

    },
};