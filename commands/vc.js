const fs = require('fs')
const stream = require('stream')
const AudioMixer = require('audio-mixer')
const { OpusEncoder } = require('@discordjs/opus')

module.exports = {
    name: "vc",
    description: "",
    async execute(message, args, gamedata) {
        var user = message.author;
        let voiceChannel;
        for (let [_, channel] of message.guild.channels.cache) {
            if (Array.from(channel.members.values()).map(u => u.id).includes(user.id) && channel.type === "voice") {
                voiceChannel = message.guild.channels.resolve(channel.id);
                let i = 0;
                let mixer = new AudioMixer.Mixer({
                    channels: 1,
                    bitDepth: 16,
                    sampleRate: 48000,
                    clearInterval: 20
                });
                
                voiceChannel.join().then(async (con) => {
                    let channelStream;
                    for (let member of Array.from(con.channel.members.values())) {
                        if (!member.user.bot) {
                            channelStream = await con.receiver.createStream(member.id, {
                                end: 'manual',
                                mode: "pcm"
                            });
                            var input = await mixer.input({
                                channels: 1,
                                sampleRate: 48000,
                                bitDepth: 16
                            })
                            console.log(member.user.tag)
                            await channelStream.pipe(input);
                        }
                    }
                    var pass = stream.PassThrough()
                    mixer.pipe(pass);
                    var encoder = new OpusEncoder(48000, 2)
                    pass.on("data", (buf) => {
                        console.log(buf.byteLength)
                        // console.log(encoder.encode(buf))
                    })
                    gamedata.settings.get("emit").emit("stream", pass);
                })
            }
        }
    },
};