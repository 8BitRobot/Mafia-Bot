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
                            let channelStream;
                            channelStream = await con.receiver.createStream(member.id, {
                                end: 'manual',
                                mode: "pcm"
                            });
                            users[member.user.tag] = {
                                input: mixer.input({
                                    channels: 2,
                                    sampleRate: 48000,
                                    bitDepth: 16
                                }),
                                stream: channelStream
                            }
                            channelStream.on("data", (buf) => {
                                console.log(member.user.tag, buf.byteLength / 4)
                                if (buf.byteLength / 4 === 960 && !!users[member.user.tag].input) {
                                    console.log("Adding Stream")
                                    users[member.user.tag].stream.pipe(users[member.user.tag].input);
                                    users[member.user.tag].input = undefined;
                                    console.log("Added Stream", users[member.user.tag])
                                }
                            })
                        }
                    }
                    var pass = stream.PassThrough()
                    console.log(pass);
                    mixer.pipe(pass);
                    pass.on("data", (buf) => {
                        console.log(`mixer buffer length: ${buf.byteLength / 4}`)
                    })
                    gamedata.settings.get("emit").emit("stream", pass);
                })
            }
        }
    },
};