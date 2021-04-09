const fs = require('fs')
const stream = require('stream')
const AudioMixer = require('audio-mixer')
// const { OpusEncoder } = require('@discordjs/opus')
const {
    OpusEncoder,
    OpusDecoder,
    OpusApplication
} = require("audify");
const {
    Readable
} = require('stream');

module.exports = {
    name: "vc",
    description: "",
    async execute(message, args, gamedata) {
        var user = message.author;
        let voiceChannel;
        let users = {};
        for (let [_, channel] of message.guild.channels.cache) {
            if (Array.from(channel.members.values()).map(u => u.id).includes(user.id) && channel.type === "voice") {
                voiceChannel = message.guild.channels.resolve(channel.id);
                let i = 0;
                let mixer = new AudioMixer.Mixer({
                    channels: 2,
                    bitDepth: 16,
                    sampleRate: 48000,
                    clearInterval: 1000
                });
                
                voiceChannel.join().then(async (con) => {
                    const SILENCE_FRAME = Buffer.from([0xF8, 0xFF, 0xFE]);
                    class Silence extends Readable {
                        _read() {
                            this.push(SILENCE_FRAME);
                            this.destroy();
                        }
                    }
                    con.play(new Silence(), {type: "opus"})
                    for (let member of Array.from(con.channel.members.values())) {
                        if (!member.user.bot) {
                            let channelStream = await con.receiver.createStream(member.id, {
                                end: 'manual',
                                mode: "pcm"
                            });
                            channelStream.on("data", (data) => {
                                console.log(data)
                            })
                            var input = mixer.input({
                                    channels: 2,
                                    sampleRate: 48000,
                                    bitDepth: 16
                                })
                            channelStream.pipe(input);
                        }
                    }
                    gamedata.settings.get("emit").emit("stream", mixer);
                })
            }
        }
    },
};