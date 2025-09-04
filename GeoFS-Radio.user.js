// ==UserScript==
// @name         GeoFS Radio
// @namespace    https://github.com/Ariakim-Taiyo/GeoFS-Radio
// @version      0.1.3
// @description  Adds a VHF Radio to GeoFS
// @author       AriakimTaiyo
// @match        https://geo-fs.com/geofs.php*
// @match        https://*.geo-fs.com/geofs.php*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=geo-fs.com
// @grant        none
// @downloadURL  https://github.com/Ariakim-Taiyo/GeoFS-Radio/raw/refs/heads/main/GeoFS-Radio.user.js
// @updateURL    https://github.com/Ariakim-Taiyo/GeoFS-Radio/raw/refs/heads/main/GeoFS-Radio.user.js
// ==/UserScript==

async function initRadioDefault() {
    await radio.init(), radio.adoptGeoId(), radio.tune(121.5), radio.useHttpSignaler("aHR0cHM6Ly9yYWRpby1zaWduYWxlci5hcmlha2ltdGFpeW9hbHQud29ya2Vycy5kZXY="), 
    await radio.start(), await radio.unlockAudio(), radio.setDegrade(!0);
}

(() => {
    var r = "[GeoFS Radio]", e = "v_1.3", v = (...e) => {
        console.log(r, ...e);
    }, n = () => Date.now(), i = e => Math.max(0, Math.min(1, e)), l = e => (e?.match?.(/^a=candidate:/gm) || []).length, o = e => /a=end-of-candidates/m.test(e || ""), c = (e, t) => {
        var i = +e, a = +t, s = Number.isFinite(i), r = Number.isFinite(a);
        return s && r ? i < a ? -1 : a < i ? 1 : 0 : String(e) < String(t) ? -1 : String(e) > String(t) ? 1 : 0;
    }, a = (e, t) => {
        let i = String(e) + "|" + String(t), a = 2166136261;
        for (let e = 0; e < i.length; e++) a ^= i.charCodeAt(e), a = Math.imul(a, 16777619);
        return (a >>> 0) / 4294967295;
    };
    function s() {
        try {
            var e = geofs?.aircraft?.instance?.llaLocation;
            if (e && isFinite(e[0]) && isFinite(e[1]) && isFinite(e[2])) return {
                lat: e[0],
                lon: e[1],
                alt_m: e[2]
            };
        } catch {}
        return {
            lat: 0,
            lon: 0,
            alt_m: 0
        };
    }
    function d() {
        var e = s();
        return [ e.lat, e.lon, e.alt_m ];
    }
    function h(i, a = 6e3) {
        return new Promise(e => {
            if ("complete" === i.iceGatheringState) return e();
            var t = () => {
                "complete" === i.iceGatheringState && (i.removeEventListener("icegatheringstatechange", t), 
                e());
            };
            i.addEventListener("icegatheringstatechange", t), setTimeout(() => {
                i.removeEventListener("icegatheringstatechange", t), e();
            }, a);
        });
    }
    class t {
        constructor() {
            this.ctx = null, this.localStream = null, this.localTrack = null, this.muted = !1, 
            this.sourceMode = "mic", this.bcast = null, this.rx = new Map(), this.fxEnabled = !1, 
            this.fx = new Map(), this.pttBlipMs = 90, this.rxBus = null, this.rxGateOpen = !0, 
            this.het = null, this._fxTick = null, this._fxPeerSample = null, this._fxActivitySample = null;
        }
        async init() {
            if (!this.ctx) {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)(), 
                this.rxBus = this.ctx.createGain(), this.rxBus.gain.value = 1, this.rxBus.connect(this.ctx.destination);
                var e = this.ctx.createOscillator(), t = (e.type = "sine", this.ctx.createGain());
                t.gain.value = 0, e.connect(t).connect(this.rxBus);
                try {
                    e.start();
                } catch {}
                this.het = {
                    osc: e,
                    gain: t
                }, this.localStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: !0,
                        noiseSuppression: !0,
                        autoGainControl: !0,
                        channelCount: 1,
                        sampleRate: 48e3
                    },
                    video: !1
                }), this.localTrack = this.localStream.getAudioTracks()[0], this.localTrack && (this.localTrack.enabled = !1), 
                v("Mic ready:", this.localTrack?.label);
            }
        }
        async unlock() {
            try {
                await this.ctx?.resume();
            } catch {}
            for (var [ , e ] of this.rx) try {
                await e.play();
            } catch {}
            try {
                this.bcast?.el && await this.bcast.el.play().catch(() => {});
            } catch {}
            v("AudioContext:", this.ctx?.state);
        }
        getActiveTxTrack() {
            return "broadcast" === this.sourceMode && this.bcast?.track ? this.bcast.track : this.localTrack;
        }
        setSourceMode(e) {
            "mic" !== e && "broadcast" !== e || (this.sourceMode = e, v("TX source:", e));
        }
        async loadBroadcast(e, {
            loop: t = !0,
            monitor: i = !1,
            volume: a = 1,
            monitorVol: s = .3
        } = {}) {
            this.ctx || await this.init(), this.stopBroadcast();
            var r = new Audio(), t = (r.crossOrigin = "anonymous", r.autoplay = !1, 
            r.playsInline = !0, r.controls = !1, r.loop = !!t, r.preload = "auto", 
            r.src = e, this.ctx.createMediaElementSource(r)), o = this.ctx.createGain(), a = (o.gain.value = Math.max(1e-4, Number(a) || 1), 
            this.ctx.createMediaStreamDestination());
            t.connect(o).connect(a);
            let n = null;
            i && ((n = this.ctx.createGain()).gain.value = Math.max(0, Number(s) || .3), 
            t.connect(n).connect(this.ctx.destination));
            i = a.stream.getAudioTracks()[0];
            return i.enabled = !1, this.bcast = {
                el: r,
                srcNode: t,
                gain: o,
                monitor: n,
                dest: a,
                stream: a.stream,
                track: i,
                url: e
            }, r.play().catch(() => {}), v("Broadcast source loaded:", e), i;
        }
        stopBroadcast() {
            var e = this.bcast;
            if (e) {
                try {
                    e.el.pause(), e.el.src = "";
                } catch {}
                try {
                    e.srcNode.disconnect(), e.gain.disconnect(), e.monitor?.disconnect();
                } catch {}
                this.bcast = null, "broadcast" === this.sourceMode && (this.sourceMode = "mic"), 
                v("Broadcast source cleared.");
            }
        }
        bcastInfo() {
            var e = this.bcast;
            return e ? {
                url: e.url,
                playing: !e.el.paused,
                t: e.el.currentTime,
                loop: e.el.loop,
                vol: e.gain.gain.value
            } : null;
        }
        setPTT(e) {
            var t = this.getActiveTxTrack();
            t && (t.enabled = !!e && !this.muted);
        }
        setMuted(e) {
            this.muted = !!e;
            e = this.getActiveTxTrack();
            e && (e.enabled = e.enabled && !this.muted);
        }
        setRxGate(e) {
            if (this.rxGateOpen = !!e, this.rxBus && (this.rxBus.gain.value = e ? 1 : 0), 
            !this.fxEnabled) for (var [ , t ] of this.rx) try {
                t.volume = e ? 1 : 0;
            } catch {}
        }
        _ensureRxElement(e, t) {
            let i = this.rx.get(e);
            return i || ((i = new Audio()).autoplay = !0, i.playsInline = !0, i.controls = !1, 
            i.preload = "auto", i.disableRemotePlayback = !0, this.rx.set(e, i)), 
            i.srcObject !== t && (i.srcObject = t), i.muted = !1, i.volume = this.fxEnabled ? 1e-4 : this.rxGateOpen ? 1 : 0, 
            i.play().catch(async () => {
                try {
                    await this.unlock(), await i.play();
                } catch {}
            }), i;
        }
        _noiseBuffer(e = 2) {
            var t = this.ctx.sampleRate, i = Math.floor(e * t), e = this.ctx.createBuffer(1, i, t), a = e.getChannelData(0);
            for (let e = 0; e < i; e++) a[e] = 2 * Math.random() - 1;
            return e;
        }
        _softClipCurve(e = .5, t = 1024) {
            var i = new Float32Array(t), a = 10 * e;
            for (let e = 0; e < t; e++) {
                var s = e / (t - 1) * 2 - 1;
                i[e] = (1 + a) * s / (1 + a * Math.abs(s));
            }
            return i;
        }
        _buildFxChain(e, t) {
            let i = this.ctx, a = this._ensureRxElement(e, t), s = t && t.getAudioTracks && t.getAudioTracks().length ? t : null;
            if (!s) try {
                var r = a.captureStream ? a.captureStream() : a.mozCaptureStream ? a.mozCaptureStream() : null;
                r && r.getAudioTracks && r.getAudioTracks().length && (s = r);
            } catch {}
            if (!s) return v("FX: no valid tap stream; using element path without FX"), 
            this._ensureRxElement(e, t);
            var r = i.createMediaStreamSource(s), t = i.createAnalyser(), o = (t.fftSize = 512, 
            r.connect(t), i.createBiquadFilter()), n = (o.type = "highpass", o.frequency.value = 300, 
            o.Q.value = .707, i.createBiquadFilter()), l = (n.type = "lowpass", 
            n.frequency.value = 3200, n.Q.value = .707, i.createDynamicsCompressor()), c = (l.threshold.value = -18, 
            l.knee.value = 2, l.ratio.value = 3, l.attack.value = .005, l.release.value = .1, 
            i.createWaveShaper()), d = (c.curve = this._softClipCurve(.2), i.createGain()), h = (d.gain.value = 1, 
            i.createBufferSource()), u = (h.buffer = this._noiseBuffer(2), h.loop = !0, 
            i.createBiquadFilter()), p = (u.type = "highpass", u.frequency.value = 300, 
            u.Q.value = .707, i.createBiquadFilter()), m = (p.type = "lowpass", 
            p.frequency.value = 3200, p.Q.value = .707, i.createGain()), g = (m.gain.value = 0, 
            i.createGain());
            g.gain.value = 1, r.connect(o).connect(n).connect(l).connect(d).connect(g), 
            h.connect(u).connect(p).connect(m).connect(g), g.connect(this.rxBus);
            try {
                h.start();
            } catch {}
            r = {
                _tapEl: a,
                _tapStream: s,
                srcNode: r,
                hp: o,
                lp: n,
                comp: l,
                shaper: c,
                voiceGain: d,
                nSrc: h,
                nHP: u,
                nLP: p,
                noiseGain: m,
                sum: g,
                _probe: t,
                _buf: new Uint8Array(t.frequencyBinCount),
                _lastRMS: 0,
                _lastAct: 0,
                _blipUntil: 0
            };
            return this.fx.set(e, r), this.unlock().catch(() => {}), v("REMOTE TRACK (FX via direct stream) from", e), 
            r;
        }
        _destroyFxChain(e) {
            var t = this.fx.get(e);
            if (t) {
                try {
                    t.nSrc?.stop();
                } catch {}
                for (var i in t) try {
                    t[i].disconnect?.();
                } catch {}
                this.fx.delete(e);
            }
        }
        _applyPerPeer(e, t, i, a) {
            var s, r, e = this.fx.get(e);
            e && (e.lp.frequency.value = 1500 + 1700 * t, e.shaper.curve = this._softClipCurve(.2 + .3 * (1 - t)), 
            s = t = t, a = a && 5e-4 < a ? Math.min(.8, a) : .12, !i || t <= 1e-4 ? (e.voiceGain.gain.value = 0, 
            e.noiseGain.gain.value = 0) : (performance.now() < e._blipUntil ? (r = t * a / .577, 
            e.voiceGain.gain.value = 0) : (r = t * (1 - s) * a / .577, e.voiceGain.gain.value = t * s), 
            e.noiseGain.gain.value = r));
        }
        attachRemote(e, t) {
            var i = this._ensureRxElement(e, t);
            this.fxEnabled ? (this._destroyFxChain(e), this._buildFxChain(e, t)) : (this._destroyFxChain(e), 
            i.volume = this.rxGateOpen ? 1 : 0), this.unlock().catch(() => {});
        }
        detachRemote(e) {
            this._destroyFxChain(e);
            var t = this.rx.get(e);
            if (t) {
                try {
                    t.pause(), t.srcObject = null;
                } catch {}
                this.rx.delete(e);
            }
        }
        _setHeterodyne(e) {
            if (this.het) if (this.rxGateOpen) if (!e || e.length < 2) this.het.gain.gain.value = 0; else {
                var t = [ ...e ].sort((e, t) => String(e).localeCompare(String(t))), t = a(t[0], t[1]), t = 300 + Math.floor(1600 * t);
                try {
                    this.het.osc.frequency.setTargetAtTime(t, this.ctx.currentTime, .02);
                } catch {
                    this.het.osc.frequency.value = t;
                }
                t = .12 + .06 * Math.min(3, e.length - 2);
                this.het.gain.gain.value = 4 * t;
            } else this.het.gain.gain.value = 0;
        }
        enableDegrade(e, t) {
            if (!this.fxEnabled) {
                if (this.fxEnabled = !0, this._fxPeerSample = e, this._fxActivitySample = t, 
                !this._fxTick) {
                    var a = () => {
                        if (this._fxPeerSample) {
                            var r, o, n = [];
                            for ([ r, o ] of this._fxPeerSample()) {
                                let e = this.fx.get(r), a = 0;
                                if (e && e._probe) {
                                    e._probe.getByteTimeDomainData(e._buf);
                                    let t = 0, i = e._buf;
                                    for (let e = 0; e < i.length; e++) {
                                        var l = (i[e] - 128) / 128;
                                        t += l * l;
                                    }
                                    a = Math.sqrt(t / i.length), e._lastRMS = a;
                                }
                                let t = 0, i = !1, s;
                                "function" == typeof this._fxActivitySample && ((s = this._fxActivitySample(r)) && "boolean" == typeof s.dc ? (t = s.dc ? 1 : 0, 
                                i = !0) : "number" == typeof s?.lvl && (t = .003 < s.lvl ? 1 : 0)), 
                                (t = i ? t : t || (.015 < a ? 1 : 0)) && .05 < o && n.push(r), 
                                e && (1 === t && 0 === e._lastAct && (e._blipUntil = performance.now() + this.pttBlipMs), 
                                e._lastAct = t), this._applyPerPeer(r, o, t, a);
                            }
                            this._setHeterodyne(n);
                        }
                    };
                    if (this._fxTick = a, geofs?.api?.addFrameCallback) geofs.api.addFrameCallback(a); else {
                        let i = performance.now();
                        !function e() {
                            var t = performance.now();
                            t - i > 1e3 / 30 && (a(), i = t), requestAnimationFrame(e);
                        }();
                    }
                }
                v("Degradation ON");
            }
        }
        disableDegrade() {
            if (this.fxEnabled) {
                this.fxEnabled = !1, this._fxPeerSample = null, this._fxActivitySample = null;
                for (var e of Array.from(this.fx.keys())) this._destroyFxChain(peerId);
                for (var [ , t ] of this.rx.entries()) try {
                    t.volume = this.rxGateOpen ? 1 : 0;
                } catch {}
                this.het && (this.het.gain.gain.value = 0), v("Degradation OFF");
            }
        }
    }
    class u {
        constructor(e, t) {
            this.radio = e, this.id = t, this.pc = null, this.dc = null, this.remoteStream = new MediaStream(), 
            this.rxReceiver = null, this.connected = !1, this.inProgress = !1, this.lastOfferAt = 0, 
            this.lastAnswerAt = 0, this.audioSender = null, this._discTimer = null, 
            this._triedIceRestart = !1;
        }
        _wirePC() {
            var i = new RTCPeerConnection({
                iceServers: [ {
                    urls: "stun:stun.l.google.com:19302"
                } ],
                bundlePolicy: "max-bundle",
                rtcpMuxPolicy: "require"
            }), t = a => {
                this._discTimer || (!this._triedIceRestart && c(this.radio.id, this.id) < 0 && setTimeout(async () => {
                    try {
                        var e, t, i;
                        this.pc && ("disconnected" !== (e = this.pc.iceConnectionState) && "failed" !== e || (this._triedIceRestart = !0, 
                        v(`ICE restart offer -> ${this.id} (reason=${a})`), t = await this.pc.createOffer({
                            offerToReceiveAudio: !0,
                            iceRestart: !0
                        }), await this.pc.setLocalDescription(t), await h(this.pc), 
                        i = this.pc.localDescription, await this.radio._publish({
                            op: "offer",
                            from: this.radio.id,
                            to: this.id,
                            room: this.radio.roomId,
                            sdp: i
                        }, void 0, {
                            urgent: !0
                        })));
                    } catch (e) {
                        console.warn("ICE-restart attempt failed", e);
                    }
                }, Math.min(4e3, Math.max(1500, 4200))), this._discTimer = setTimeout(() => {
                    this._discTimer = null, this._triedIceRestart = !1;
                    var e = i?.connectionState, t = i?.iceConnectionState;
                    "connected" !== e && "connected" !== t && "completed" !== t && this.radio._onPeerDown(this.id, a, e, t);
                }, 12e3));
            }, a = () => {
                this._discTimer && (clearTimeout(this._discTimer), this._discTimer = null), 
                this._triedIceRestart = !1;
            }, e = (i.onicecandidate = () => {}, i.onicegatheringstatechange = () => v(`ICE gather(${this.id}):`, i.iceGatheringState), 
            i.onsignalingstatechange = () => v(`Signal(${this.id}):`, i.signalingState), 
            i.oniceconnectionstatechange = () => {
                var e = i.iceConnectionState;
                v(`ICE conn(${this.id}):`, e), "connected" === e || "completed" === e ? a() : "disconnected" === e ? t("ice-disconnected") : "failed" !== e && "closed" !== e || this.radio._onPeerDown(this.id, "ice-terminal", i.connectionState, e);
            }, i.ontrack = t => {
                (t.streams && t.streams[0] ? t.streams[0] : new MediaStream([ t.track ])).getTracks().forEach(e => {
                    this.remoteStream.getTracks().includes(e) || this.remoteStream.addTrack(e);
                });
                try {
                    this.rxReceiver = i.getReceivers().find(e => e.track === t.track) || null;
                } catch {}
                this.radio.audio.attachRemote(this.id, this.remoteStream);
            }, i.ondatachannel = e => {
                this.dc = e.channel, this._wireDC(this.dc, !1, a, t);
            }, i.onconnectionstatechange = () => {
                var e = i.connectionState;
                v(`PC(${this.id}) state:`, e), this.connected = "connected" === e, 
                "connected" === e ? (a(), this.radio._cancelRedial(this.id)) : "disconnected" === e ? t("pc-disconnected") : "failed" !== e && "closed" !== e || this.radio._onPeerDown(this.id, "pc-terminal", e, i.iceConnectionState);
            }, this.pc = i, this.radio.audio.getActiveTxTrack());
            this.audioSender = this.pc.addTrack(e, new MediaStream([ e ]));
        }
        _wireDC(e, t, i, a) {
            e.onopen = () => {
                v(`DC open ${t ? "->" : "<-"} ` + this.id), i?.(), this.radio._cancelRedial(this.id), 
                this.radio._sendPTTTo(this.id, this.radio.ptt || this.radio._txHold), 
                this.radio._sendPosTo(this.id, !0);
            }, e.onmessage = e => {
                try {
                    var t = JSON.parse(e.data);
                    "ptt" === t.t ? this.radio._setPeerPTT(this.id, !!t.v) : "pos" === t.t && this.radio._updateRemotePos(this.id, t);
                } catch {}
            }, e.onclose = () => {
                v(`DC closed ${t ? "->" : "<-"} ` + this.id), setTimeout(() => {
                    var e = this.pc?.connectionState, t = this.pc?.iceConnectionState;
                    this.pc && e && "connected" !== e && ("failed" === t || "disconnected" === t || "closed" === t) && a?.("dc-closed");
                }, 4e3);
            };
        }
        ensurePC() {
            this.pc || this._wirePC();
        }
        async makeOfferAndSend() {
            var e;
            this.inProgress || this.connected || n() - this.lastOfferAt < 2e3 || this.pc && "stable" !== this.pc.signalingState || (this.lastOfferAt = n(), 
            this.radio.audio.localTrack || await this.radio.audio.init(), this.inProgress = !0, 
            this.ensurePC(), this.dc || (this.dc = this.pc.createDataChannel("state"), 
            this._wireDC(this.dc, !0)), e = await this.pc.createOffer({
                offerToReceiveAudio: !0,
                voiceActivityDetection: !1
            }), await this.pc.setLocalDescription(e), await h(this.pc), e = this.pc.localDescription, 
            v(`OFFER -> ${this.id} cand=${l(e.sdp)} eof=` + o(e.sdp)), await this.radio._publish({
                op: "offer",
                from: this.radio.id,
                to: this.id,
                room: this.radio.roomId,
                sdp: e
            }, void 0, {
                urgent: !0
            }));
        }
        async acceptOfferAndAnswer(t) {
            if (!this.connected) {
                this.radio.audio.localTrack || await this.radio.audio.init(), this.ensurePC();
                try {
                    await this.pc.setRemoteDescription(t);
                } catch (e) {
                    if ("have-local-offer" !== this.pc.signalingState) return void console.warn("setRemoteDescription(offer) failed", e);
                    try {
                        await this.pc.setLocalDescription({
                            type: "rollback"
                        }), await this.pc.setRemoteDescription(t), v("Glare resolved by rollback with " + this.id);
                    } catch (e) {
                        return void console.warn("Failed glare rollback", e);
                    }
                }
                t = await this.pc.createAnswer(), t = (await this.pc.setLocalDescription(t), 
                await h(this.pc), this.pc.localDescription);
                this.lastAnswerAt = n(), v(`ANSWER -> ${this.id} cand=${l(t.sdp)} eof=` + o(t.sdp)), 
                await this.radio._publish({
                    op: "answer",
                    from: this.radio.id,
                    to: this.id,
                    room: this.radio.roomId,
                    sdp: t
                }, void 0, {
                    urgent: !0
                }), this.inProgress = !1;
            }
        }
        async acceptAnswer(e) {
            if (this.pc) try {
                await this.pc.setRemoteDescription(e), this.inProgress = !1, v("ANSWER applied from " + this.id);
            } catch (e) {
                console.warn("setRemoteDescription(answer) failed", e);
            }
        }
        async replaceAudioTrack(e) {
            this.audioSender?.replaceTrack ? await this.audioSender.replaceTrack(e) : this.audioSender = this.pc.addTrack(e, new MediaStream([ e ]));
        }
        close() {
            if (this._discTimer) {
                try {
                    clearTimeout(this._discTimer);
                } catch {}
                this._discTimer = null;
            }
            this._triedIceRestart = !1;
            try {
                this.dc && this.dc.close();
            } catch {}
            try {
                this.pc && this.pc.close();
            } catch {}
            this.pc = null, this.dc = null, this.connected = !1, this.inProgress = !1, 
            this.rxReceiver = null, this.audioSender = null, this.radio.audio.detachRemote(this.id), 
            this.remoteStream = new MediaStream();
        }
    }
    window.radio = new class {
        constructor() {
            this.id = "r" + Math.random().toString(36).slice(2, 10), this.name = "Pilot-" + String(this.id).slice(-4), 
            this.freqMHz = 121.5, this.roomId = this._roomFor(this.freqMHz), this.audio = new t(), 
            this.peers = new Map(), this.known = new Set(), this.helloReplied = new Set(), 
            this.maxPeers = 1e3, this.signaler = null, this._prefix = "RDO:", this.enabled = !1, 
            this.ptt = !1, this._txHold = !1, this._helloTimer = null, this.autoDisconnectOnTune = !0, 
            this._peerPTT = new Map(), this._remotePos = new Map(), this._posTimer = null, 
            this._losCfg = {
                samplesBase: 10,
                samplesPer100km: 10,
                maxSamples: 20,
                clearance: 1,
                minIntervalMs: 300,
                sensitivity: .5
            }, this._losCache = new Map(), this.autoRekey = !0, this._idWatchTimer = null, 
            this._lastGidSeen = null, this._rekeyPending = null, this._helloSeenAt = new Map(), 
            this._lastHelloAt = 0, this._sentByeForRoom = new Set(), this._pubQ = [], 
            this._pubFlush = null, this._unloadHooked = !1, this._redial = new Map(), 
            this._redialMax = 5;
        }
        help() {
            console.log(`
${r} ${e}
`);
        }
        async init() {
            try {
                this.adoptGeoId();
            } catch {}
            await this.audio.init(), v("Initialized with id:", this.id);
        }
        async unlockAudio() {
            await this.audio.unlock();
        }
        adoptGeoId() {
            var e = window?.multiplayer?.myId;
            return null == e ? (v("GeoFS multiplayer.myId not available yet; keeping", this.id), 
            !1) : (e = String(e), this.id !== e && this.enabled && v("WARNING: change id before start()"), 
            this.id = e, this.name = "Pilot-" + e.slice(-4), v("Adopted GeoFS id:", e), 
            !0);
        }
        setMuted(e) {
            this.audio.setMuted(!!e);
        }
        setName(e) {
            this.name = String(e || "").slice(0, 32) || this.name;
        }
        setMaxPeers(e) {
            this.maxPeers = Math.max(1, Number(e) || 1);
        }
        peersList() {
            var e = [ ...this.peers.keys() ];
            return v("Peers:", e), e;
        }
        state() {
            var e = {
                id: this.id,
                room: this.roomId,
                peers: [ ...this.peers.keys() ],
                txHold: this._txHold,
                src: this.audio.sourceMode
            };
            return v("State:", e), e;
        }
        setPttBlip(e) {
            this.audio.pttBlipMs = Math.max(0, Number(e) || 0), v("PTT blip ms:", this.audio.pttBlipMs);
        }
        setLosOptions(e = {}) {
            Object.assign(this._losCfg, e || {}), v("LOS cfg:", this._losCfg);
        }
        setAutoRekey(e = !0) {
            this.autoRekey = !!e, e && this.enabled ? this._startIdWatch() : this._stopIdWatch();
        }
        forceIdCheck() {
            this._idWatchTick(!0);
        }
        _setPeerPTT(e, t) {
            this._peerPTT.set(e, {
                v: !!t,
                ts: n()
            });
        }
        _isPeerPTT(e) {
            e = this._peerPTT.get(e);
            return e ? !!e.v : null;
        }
        _updateRemotePos(e, t) {
            t && "number" == typeof t.lat && "number" == typeof t.lon && "number" == typeof t.alt && this._remotePos.set(e, {
                lat: t.lat,
                lon: t.lon,
                alt: t.alt,
                ts: t.ts || n()
            });
        }
        _sendPosTo(e, t = !1) {
            e = this.peers.get(e);
            if (e?.dc && "open" === e.dc.readyState) {
                var i = s(), a = this._lastPosSent || {
                    lat: null,
                    lon: null,
                    alt: null,
                    ts: 0
                };
                if (!(!t && a.lat === i.lat && a.lon === i.lon && Math.abs(a.alt - i.alt_m) < .5 && n() - a.ts < 400)) {
                    try {
                        e.dc.send(JSON.stringify({
                            t: "pos",
                            lat: i.lat,
                            lon: i.lon,
                            alt: i.alt_m,
                            ts: n()
                        }));
                    } catch {}
                    this._lastPosSent = {
                        lat: i.lat,
                        lon: i.lon,
                        alt: i.alt_m,
                        ts: n()
                    };
                }
            }
        }
        _broadcastPos() {
            for (var [ e ] of this.peers) this._sendPosTo(e, !1);
        }
        _sendPTTTo(e, t) {
            e = this.peers.get(String(e));
            if (e?.dc && "open" === e.dc.readyState) try {
                e.dc.send(JSON.stringify({
                    t: "ptt",
                    v: !!t
                }));
            } catch {}
        }
        _broadcastPTT(e) {
            for (var [ t, i ] of this.peers) if (i?.dc && "open" === i.dc.readyState) try {
                i.dc.send(JSON.stringify({
                    t: "ptt",
                    v: !!e
                }));
            } catch {}
        }
        remotePos() {
            var e, t, i = {};
            for ([ e, t ] of this._remotePos) i[e] = {
                ...t,
                age_ms: n() - t.ts
            };
            return console.table(i), i;
        }
        _peerLLA_DC(e) {
            e = this._remotePos.get(e);
            return e && n() - e.ts < 5e3 ? [ e.lat, e.lon, e.alt ] : null;
        }
        _peerLLA_MP(e) {
            try {
                var t = window?.multiplayer?.users?.[e]?.lastUpdate?.co;
                if (Array.isArray(t) && isFinite(t[0]) && isFinite(t[1]) && isFinite(t[2])) return [ t[0], t[1], t[2] ];
            } catch {}
            return null;
        }
        _peerLLA(e) {
            return this._peerLLA_DC(e) || this._peerLLA_MP(e);
        }
        _losQualityBetween(e, t) {
            if (!Cesium?.Cartesian3 || !Cesium?.Cartographic) return {
                q: 1,
                blocked: 0,
                total: 1
            };
            var n = Cesium, l = this._losCfg || {}, c = n.Cartesian3.fromDegrees(e[1], e[0], e[2]), d = n.Cartesian3.fromDegrees(t[1], t[0], t[2]), e = n.Cartesian3.distance(c, d), h = Math.round((l.samplesBase ?? 24) + (l.samplesPer100km ?? 24) * (e / 1e5)), h = Math.max(8, Math.min(l.maxSamples ?? 96, 0 | h)), u = new n.Cartesian3();
            let p = 0;
            for (let o = 1; o <= h; o++) {
                let e = o / (h + 1), t = (n.Cartesian3.lerp(c, d, e, u), n.Cartographic.fromCartesian(u)), i = n.Math.toDegrees(t.latitude), a = n.Math.toDegrees(t.longitude), s = t.height, r = 0;
                try {
                    var m = geofs.getGroundAltitude([ i, a, s ]);
                    r = m.location[2];
                } catch {}
                r + (l.clearance ?? 25) >= s && p++;
            }
            t = Math.max(.05, l.sensitivity ?? 1);
            return {
                q: i(1 - p / (h * t)),
                blocked: p,
                total: h
            };
        }
        _losQualityCached(e) {
            var t = this._losCfg, i = this._losCache.get(e);
            return i && n() - i.ts < (t.minIntervalMs ?? 300) ? i : (t = d(), t = (i = this._peerLLA(e)) ? {
                ...this._losQualityBetween(t, i),
                ts: n()
            } : {
                q: .6,
                blocked: 0,
                total: 1,
                ts: n()
            }, this._losCache.set(e, t), t);
        }
        losPeek(e) {
            if (e) return a = this._losQualityCached(e), v("LOS", e, a), a;
            var t, i = [];
            for (t of this.peers.keys()) {
                var a = this._losQualityCached(t);
                i.push({
                    peer: t,
                    q: +a.q.toFixed(3),
                    blocked: a.blocked,
                    samples: a.total,
                    age_ms: n() - a.ts
                });
            }
            console.table(i);
        }
        losPeekAll() {
            return this.losPeek();
        }
        linkQuality(e) {
            return this._losQualityCached(e).q;
        }
        setDegrade(e = !0) {
            e ? this.audio.enableDegrade(() => {
                var e, t = [];
                for ([ e ] of this.peers) t.push([ e, this.linkQuality(e) ]);
                return t;
            }, e => {
                let t = this.peers.get(e), i = this._peerPTT.get(e), a = !!(i && n() - i.ts <= 5e3), s;
                try {
                    var r = t?.rxReceiver?.getSynchronizationSources?.();
                    r && r.length && (s = r[0].audioLevel);
                } catch {}
                return a ? {
                    dc: !!i.v
                } : {
                    lvl: s
                };
            }) : this.audio.disableDegrade();
            for (var [ t, i ] of this.peers) {
                try {
                    this.audio.detachRemote(t);
                } catch {}
                this.audio.attachRemote(t, i.remoteStream);
            }
        }
        fxRewire() {
            for (var [ e, t ] of this.peers) {
                try {
                    this.audio.detachRemote(e);
                } catch {}
                this.audio.attachRemote(e, t.remoteStream);
            }
            v("FX rewired.");
        }
        fxPeek() {
            var e, t, i = [];
            for ([ e, t ] of this.audio.fx.entries()) {
                var a = this._losCache.get(e);
                i.push({
                    peer: e,
                    q: a ? +a.q.toFixed(3) : null,
                    blocked: a?.blocked,
                    samp: a?.total,
                    voice: +(t.voiceGain?.gain?.value ?? 0).toFixed(3),
                    noise: +(t.noiseGain?.gain?.value ?? 0).toFixed(3),
                    preFxRMS: +(t._lastRMS ?? 0).toFixed(3),
                    blip: performance.now() < (t._blipUntil || 0)
                });
            }
            i.length ? console.table(i) : console.log(r, "FX: no chains.");
        }
        _updateTxRxGate() {
            var e = !(this.ptt || this._txHold);
            this.audio.setRxGate(e);
        }
        txHold(e = !0) {
            this._txHold = !!e, this.audio.setPTT(this._txHold || this.ptt), this._broadcastPTT(this._txHold || this.ptt), 
            this._updateTxRxGate();
        }
        pttDown() {
            this.ptt = !0, this.audio.setPTT(!0), this._txHold && this.audio.setPTT(!0), 
            this._broadcastPTT(!0), this._updateTxRxGate();
        }
        pttUp() {
            this.ptt = !1, this.audio.setPTT(this._txHold), this._broadcastPTT(this._txHold), 
            this._updateTxRxGate();
        }
        async broadcastFrom(e, t = {}) {
            await this.audio.loadBroadcast(e, t), this.audio.setSourceMode("broadcast"), 
            await this._applyTxTrackToAll(), t.autoPTT && this.pttDown(!0), v("Broadcast mode ON:", e);
        }
        useMic() {
            this.audio.setSourceMode("mic"), this._applyTxTrackToAll(), v("Mic mode ON");
        }
        bcastInfo() {
            return v("Broadcast:", this.audio.bcastInfo()), this.audio.bcastInfo();
        }
        async _applyTxTrackToAll() {
            var e, t = this.audio.getActiveTxTrack(), i = (t.enabled = (this._txHold || this.ptt) && !this.audio.muted, 
            []);
            for ([ , e ] of this.peers) e?.pc && i.push(e.replaceAudioTrack(t));
            await Promise.allSettled(i);
        }
        useHttpSignaler(a) {
            a = atob(a);
            var s = e => this._prefix + btoa(JSON.stringify(e)), i = e => {
                if ("string" != typeof e || !e.startsWith(this._prefix)) return null;
                try {
                    return JSON.parse(atob(e.slice(this._prefix.length)));
                } catch {
                    return null;
                }
            }, n = (e, t, i = !1) => {
                t = new URL(a + t);
                return t.searchParams.set("room", e), i && t.searchParams.set("id", this.id), 
                t.toString();
            };
            this.signaler = {
                baseUrl: a,
                subscribeForRoom: t => {
                    var e = new EventSource(n(t, "/sse", !0));
                    return v("SSE opening:", t), e.onopen = () => {
                        v("SSE open:", t);
                        var e = 60 + Math.floor(240 * Math.random());
                        setTimeout(() => this._announceHelloOnce(t), e), this._helloTimer && clearTimeout(this._helloTimer), 
                        this._helloTimer = setTimeout(() => {
                            this._helloTimer = null, this._announceHelloOnce(t);
                        }, 2e3);
                    }, e.onmessage = e => {
                        e = i(e.data);
                        e && this._onSignal(e);
                    }, e.onerror = () => {}, {
                        es: e,
                        room: t,
                        close: () => e.close()
                    };
                },
                send: async (e, t, {
                    urgent: i = !1
                } = {}) => {
                    t = t || this.roomId;
                    if (!i) return this._pubQ.push({
                        room: t,
                        payload: e
                    }), this._pubFlush ? void 0 : void (this._pubFlush = setTimeout(async () => {
                        var e, t, i, a = this._pubQ.splice(0), s = (this._pubFlush = null, 
                        new Map());
                        for (e of a) (i = s.get(e.room) || s.set(e.room, []).get(e.room)).push(e.payload);
                        for ([ t, i ] of s) {
                            var r, o = [];
                            for (r of i) o.push(r);
                            await fetch(n(t, "/pub"), {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify(o)
                            }).catch(() => {});
                        }
                    }, 60));
                    await fetch(n(t, "/pub"), {
                        method: "POST",
                        headers: {
                            "Content-Type": "text/plain"
                        },
                        body: s(e)
                    }).catch(() => {});
                },
                unsub: null,
                esRoom: null
            }, v("HTTP signaler set:", a);
        }
        async _subscribeSignalerForRoom(e) {
            var t;
            this.signaler && (await this._unsubscribeIfRoom(this.signaler.esRoom), 
            t = this.signaler.subscribeForRoom(e), this.signaler.unsub = () => {
                try {
                    t.close();
                } catch {}
            }, this.signaler.esRoom = e, this.known.clear(), this.helloReplied.clear(), 
            this._helloSeenAt.clear(), this._lastHelloAt = 0);
        }
        async _unsubscribeIfRoom(e) {
            if (this.signaler?.unsub && this.signaler.esRoom === e) {
                try {
                    this.signaler.unsub();
                } catch {}
                this.signaler.unsub = null, this.signaler.esRoom = null, v("SSE closed:", e);
            }
        }
        async _publish(e, t, i) {
            if (this.signaler) return this.signaler.send(e, t, i);
        }
        async _leaveRoomClean(e) {
            if (!this._sentByeForRoom.has(e)) {
                try {
                    await this._publish({
                        op: "bye",
                        id: this.id,
                        room: e
                    }, e, {
                        urgent: !0
                    });
                } catch {}
                this._sentByeForRoom.add(e), setTimeout(() => this._sentByeForRoom.delete(e), 1e4);
            }
            for (var [ , t ] of this.peers) try {
                t.close();
            } catch {}
            this.peers.clear(), this.known.clear(), this.helloReplied.clear(), this._cancelAllRedials(), 
            this._helloSeenAt.clear(), this._lastHelloAt = 0, await this._unsubscribeIfRoom(e), 
            this._helloTimer && (clearTimeout(this._helloTimer), this._helloTimer = null), 
            this._posTimer && (clearInterval(this._posTimer), this._posTimer = null);
        }
        _onSignal(e) {
            if (e && e.room === this.roomId) switch (e.op) {
              case "hello":
                if (!(r = String(e.id)) || r === this.id) return;
                var t = this._helloSeenAt.get(r) || 0;
                if (n() - t < 5e3) return;
                this._helloSeenAt.set(r, n()), this.known.has(r) || v("HELLO from", r), 
                this.known.add(r);
                t = this.roomId + "|" + r;
                if (this.helloReplied.has(t) || (this.helloReplied.add(t), this._publish({
                    op: "hello",
                    id: this.id,
                    room: this.roomId,
                    ts: n()
                })), !this.enabled) return;
                c(this.id, r) < 0 && this.peers.size < this.maxPeers && ((o = this._ensurePeer(r)).connected || o.inProgress || o.makeOfferAndSend().catch(console.error));
                break;

              case "offer":
                var {
                    from: i,
                    to: a,
                    sdp: s
                } = e;
                if (String(a) !== this.id || String(i) === this.id) return;
                v("Got OFFER from", i, "cand=", l(s?.sdp || "")), this._cancelRedial(String(i)), 
                this.known.add(String(i)), (o = this._ensurePeer(String(i))).acceptOfferAndAnswer(s).catch(e => console.error("answer error", e));
                break;

              case "answer":
                var {
                    from: i,
                    to: a,
                    sdp: s
                } = e;
                if (String(a) !== this.id || String(i) === this.id) return;
                v("Got ANSWER from", i, "cand=", l(s?.sdp || "")), this._cancelRedial(String(i)), 
                (o = this._ensurePeer(String(i))).acceptAnswer(s).catch(e => console.error("accept answer error", e));
                break;

              case "bye":
                var r, o;
                (r = String(e.id)) && r !== this.id && ((o = this.peers.get(r)) && (o.close(), 
                this.peers.delete(r)), this._cancelRedial(r), this.known.delete(r), 
                this.helloReplied.delete(this.roomId + "|" + r), v("Peer left:", r));
            }
        }
        _onPeerDown(e, t = "unknown", i, a) {
            try {
                v(`Peer down: ${e} (${t}) pc=${i} ice=` + a);
                var s = this.peers.get(e);
                s && (s.close(), this.peers.delete(e)), this.enabled && this.signaler?.esRoom === this.roomId && this.known.has(e) && this._planRedial(e);
            } catch (e) {
                console.warn("Peer down cleanup error", e);
            }
        }
        _planRedial(t) {
            var e = this._redial.get(t) || {
                attempt: 0,
                timer: null
            };
            if (!e.timer) {
                const i = e.attempt + 1;
                if (i > this._redialMax) v("Redial: max attempts reached for " + t), 
                this._redial.delete(t); else {
                    e = Math.min(6500, Math.floor(700 * Math.pow(1.8, i - 1)));
                    const a = Math.max(300, Math.floor(e * (.8 + .4 * Math.random())));
                    e = setTimeout(() => {
                        var e;
                        this._redial.set(t, {
                            attempt: i,
                            timer: null
                        }), this.enabled && this.signaler?.esRoom === this.roomId && !this.peers.has(t) && this.known.has(t) ? (c(this.id, t) < 0 ? (e = this._ensurePeer(t), 
                        v(`Redial attempt #${i} -> ${t} (delay ${a}ms)`), e.makeOfferAndSend().catch(() => {})) : (v(`Redial nudge (hello) #${i} -> ` + t), 
                        this._publish({
                            op: "hello",
                            id: this.id,
                            room: this.roomId,
                            ts: n()
                        })), this._planRedial(t)) : this._redial.delete(t);
                    }, a);
                    this._redial.set(t, {
                        attempt: i,
                        timer: e
                    });
                }
            }
        }
        _cancelRedial(e) {
            var t = this._redial.get(e);
            if (t?.timer) try {
                clearTimeout(t.timer);
            } catch {}
            t && this._redial.delete(e);
        }
        _cancelAllRedials() {
            for (var [ e, t ] of this._redial) if (t?.timer) try {
                clearTimeout(t.timer);
            } catch {}
            this._redial.clear();
        }
        _announceHelloOnce(e = this.roomId) {
            n() - this._lastHelloAt < 1e4 || (this._lastHelloAt = n(), this._publish({
                op: "hello",
                id: this.id,
                room: e,
                ts: n()
            }));
        }
        _sendByeBeacon(e) {
            try {
                var t, i, a;
                this.signaler?.baseUrl && (t = e || this.roomId, i = this.signaler.baseUrl + "/pub?room=" + encodeURIComponent(t), 
                a = this._prefix + btoa(JSON.stringify({
                    op: "bye",
                    id: this.id,
                    room: t
                })), navigator.sendBeacon) && navigator.sendBeacon(i, a);
            } catch {}
        }
        _startIdWatch() {
            this.autoRekey && (this._stopIdWatch(), this._idWatchTimer = setInterval(() => this._idWatchTick(!1), 1500), 
            v("Auto-rekey watch started."));
        }
        _stopIdWatch() {
            this._idWatchTimer && (clearInterval(this._idWatchTimer), this._idWatchTimer = null);
        }
        async _idWatchTick(e) {
            var i, t = window?.multiplayer?.myId;
            null != t && (i = String(t), this._lastGidSeen !== i && (this._lastGidSeen = i, 
            e) && v("Observed GeoFS myId:", i), this.enabled) && this.autoRekey && i !== this.id && (this._rekeyPending?.to === i ? this._rekeyPending.at = n() : (this._rekeyPending = {
                to: i,
                at: n()
            }, setTimeout(async () => {
                if (this._rekeyPending && this._rekeyPending.to === i && !(n() - this._rekeyPending.at < 800)) {
                    var e, t = this.id;
                    this._rekeyPending = null, v(`GeoFS ID changed ${t} → ${i}; rekeying...`);
                    try {
                        await this._publish({
                            op: "bye",
                            id: t,
                            room: this.roomId
                        }, void 0, {
                            urgent: !0
                        });
                    } catch {}
                    for ([ , e ] of this.peers) try {
                        e.close();
                    } catch {}
                    this.peers.clear(), this.known.clear(), this.helloReplied.clear(), 
                    this._cancelAllRedials(), this._helloSeenAt.clear(), this._lastHelloAt = 0, 
                    this.id = i, this.name = "Pilot-" + i.slice(-4), this._announceHelloOnce();
                }
            }, 900)));
        }
        async start() {
            var e;
            this.signaler ? (this.enabled = !0, await this._subscribeSignalerForRoom(this.roomId), 
            this._posTimer && clearInterval(this._posTimer), this._posTimer = setInterval(() => this._broadcastPos(), 500), 
            this._startIdWatch(), this._unloadHooked || (e = () => this._sendByeBeacon(), 
            window.addEventListener("pagehide", e, {
                once: !0
            }), window.addEventListener("unload", e, {
                once: !0
            }), this._unloadHooked = !0), v("Started on", this.roomId)) : v("Call radio.useHttpSignaler(url) first.");
        }
        async stop() {
            if (this.enabled) {
                this.enabled = !1, await this._publish({
                    op: "bye",
                    id: this.id,
                    room: this.roomId
                }, void 0, {
                    urgent: !0
                }).catch(() => {});
                for (var [ , e ] of this.peers) e.close();
                this.peers.clear(), this.known.clear(), this.helloReplied.clear(), 
                this._cancelAllRedials(), await this._unsubscribeIfRoom(this.roomId), 
                this._helloTimer && (clearTimeout(this._helloTimer), this._helloTimer = null), 
                this._posTimer && (clearInterval(this._posTimer), this._posTimer = null), 
                this._stopIdWatch(), v("Stopped.");
            }
        }
        async tune(e) {
            e = Number(e);
            if (!isFinite(e) || e <= 0) return v("Invalid freq");
            var t = this.roomId, i = this._roomFor(e);
            t === i ? v("Already tuned to", i) : (this.enabled && this.autoDisconnectOnTune && await this._leaveRoomClean(t), 
            this.freqMHz = e, this.roomId = i, v("Tuned", t, "->", i), this.enabled && await this._subscribeSignalerForRoom(this.roomId));
        }
        _ensurePeer(e) {
            let t = this.peers.get(e);
            return t || (t = new u(this, e), this.peers.set(e, t), v("Peer slot for " + e)), 
            t;
        }
        redial() {
            for (var e of this.known) if (e !== this.id) {
                if (this.peers.size >= this.maxPeers) break;
                var t = this._ensurePeer(e);
                c(this.id, e) < 0 && !t.connected && !t.inProgress && t.makeOfferAndSend().catch(console.error);
            }
        }
        _roomFor(e) {
            return "COM-" + Number(e).toFixed(3);
        }
        peersList() {
            var e = [ ...this.peers.keys() ];
            return v("Peers:", e), e;
        }
        diag() {
            for (var [ e, t ] of this.peers) {
                var i = t?.pc, a = i?.localDescription?.sdp || "", s = i?.remoteDescription?.sdp || "";
                console.log(r, "DIAG(" + e + ")", {
                    pcSignaling: i?.signalingState,
                    pcConn: i?.connectionState,
                    iceConn: i?.iceConnectionState,
                    iceGather: i?.iceGatheringState,
                    localCand: l(a),
                    remoteCand: l(s),
                    localEOF: o(a),
                    remoteEOF: o(s),
                    inProgress: t?.inProgress,
                    connected: t?.connected
                });
            }
            0 === this.peers.size && console.log(r, "No peers. Known:", [ ...this.known ]);
        }
    }(), v("Loaded", e, "Global object: radio"), window.radio.help?.();
})(), setTimeout(() => {
    initRadioDefault();
}, 3e3), (() => {
    var e, t, i, a, s = "[GeoFS Radio - UI]", ge = "georadio-comm-pad", ve = "georadio-comm-box", r = "georadio-comm-style", fe = "georadio.comm.pos", be = "georadio.comm.size", ye = "georadio.comm.tab", xe = "georadio.comm.stby", we = "georadio.comm.pttKey", _e = "georadio.comm.volume", Te = "georadio.comm.pttWhileTyping", Se = "georadio.comm.pttBlipMs", ke = "georadio.comm.pttJoy", Pe = new Set(), Re = (e, t = document) => t.querySelector(e), o = !1, Me = (...e) => {
        o && console.log(s, ...e);
    };
    function Ae(e, t) {
        try {
            return JSON.parse(localStorage.getItem(e) || JSON.stringify(t));
        } catch {
            return t;
        }
    }
    function Ce(e, t) {
        try {
            localStorage.setItem(e, JSON.stringify(t));
        } catch {}
    }
    function Ee(e) {
        return Number(e).toFixed(3);
    }
    function n() {
        if (document.getElementById(ve)) return document.getElementById(ve);
        var a = document.createElement("div"), e = (a.id = ve, a.innerHTML = `
      <div class="comm-head">
        <div class="comm-title">GeoFS Radio • COMM</div>
        <div class="comm-spacer"></div>
        <button class="comm-close" title="Close" aria-label="Close">✕</button>
      </div>

      <div class="comm-tabs">
        <button class="comm-tab" data-tab="program">Program</button>
        <button class="comm-tab" data-tab="peers">Peers</button>
        <button class="comm-tab" data-tab="options">Options</button>
        <div class="lampbar">
          <div class="lamp"><div class="dot tx" id="grc-lamp-tx"></div><div>TX</div></div>
          <div class="lamp"><div class="dot rx" id="grc-lamp-rx"></div><div>RX</div></div>
        </div>
      </div>

      <div class="comm-body">
        <!-- Program -->
        <div class="panel" data-panel="program">
          <div class="grc-stack">
            <div class="grc-line">
              <div class="grc-label">Active</div>
              <div class="grc-field">
                <input class="geofs-radio-display" id="grc-active" type="text" readonly>
              </div>
            </div>

            <div class="grc-swap-bar">
              <button class="grc-swap" id="grc-swap" title="Swap active/standby">⇄ SWAP</button>
            </div>

            <div class="grc-line">
              <div class="grc-label">Standby</div>
              <div class="grc-field grc-standby-wrap">
                <input class="geofs-radio-display" id="grc-stby" type="text" placeholder="121.500">
                <div class="grc-knob" id="grc-knob" title="Drag up/down to tune 0.025 MHz"></div>
              </div>
            </div>

            <!-- Master Volume -->
            <div class="grc-line">
              <div class="grc-label">Volume</div>
              <div class="grc-field grc-volume-wrap">
                <input class="geofs-radio-display" id="grc-vol" type="text" readonly>
                <div class="grc-knob" id="grc-volknob" title="Drag up/down to change RX volume"></div>
              </div>
            </div>
          </div>

        </div>

        <!-- Peers -->
        <div class="panel" data-panel="peers">
          <div class="row" style="opacity:.85; margin-bottom:6px;">Mute disruptive users here (local mute only).</div>
          <div class="row" id="grc-state" style="opacity:.85; margin-top:8px;"></div>
          <table>
            <thead><tr><th>ID</th><th>Status</th><th>PTT</th><th>Mute</th></tr></thead>
            <tbody id="grc-peers"></tbody>
          </table>
        </div>

        <!-- Options -->
        <div class="panel" data-panel="options">
          <div class="grc-stack">
            <!-- PTT bind (keyboard) -->
            <div class="grc-line">
              <div class="grc-label">PTT Key</div>
              <div class="grc-field">
                <div class="opt-row">
                  <input class="geofs-radio-display" id="grc-ptt-display" type="text" readonly style="width:auto; min-width:140px;">
                  <button class="grc-btn" id="grc-ptt-bind"  title="Click, then press a key">Bind</button>
                  <button class="grc-btn" id="grc-ptt-clear" title="Remove binding">Clear</button>
                </div>
                <div><small class="hint">Tip: be sure to bind an unused key.</small></div>
              </div>
            </div>

            <!-- PTT bind (joystick) -->
            <div class="grc-line">
              <div class="grc-label">PTT Joystick</div>
              <div class="grc-field">
                <div class="opt-row">
                  <input class="geofs-radio-display" id="grc-joy-display" type="text" readonly style="width:auto; min-width:220px;">
                  <button class="grc-btn" id="grc-joy-bind"  title="Click, then press a joystick button or move a trigger">Bind</button>
                  <button class="grc-btn" id="grc-joy-clear" title="Remove joystick binding">Clear</button>
                </div>
                <div><small class="hint">Press a button or fully squeeze/move a trigger/axis to bind.</small></div>
              </div>
            </div>

            <!-- PTT while typing -->
            <div class="grc-line">
              <div class="grc-label">PTT in Inputs</div>
              <div class="grc-field">
                <label class="opt-row"><input type="checkbox" id="grc-ptt-typing"> Allow while typing</label>
                <div><small class="hint">Off prevents accidental TX while focused in a text field (keyboard only).</small></div>
              </div>
            </div>

            <!-- PTT blip length -->
            <div class="grc-line">
              <div class="grc-label">PTT Blip</div>
              <div class="grc-field">
                <div class="opt-row">
                  <input id="grc-pttblip" type="range" min="0" max="200" step="10" style="width:180px;">
                  <span id="grc-pttblip-val"></span>
                </div>
                <div><small class="hint">Length of the initial TX “blip” in milliseconds.</small></div>
              </div>
            </div>

            <!-- Reset window layout -->
            <div class="grc-line">
              <div class="grc-label">Layout</div>
              <div class="grc-field">
                <button class="grc-btn" id="grc-reset-ui">Reset window size/position</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `, document.body.appendChild(a), Ae(be, null)), e = (e && "number" == typeof e.w && "number" == typeof e.h && (a.style.width = Math.max(380, e.w) + "px", 
        a.style.height = Math.max(260, e.h) + "px"), Ae(fe, null));
        e && "number" == typeof e.x && "number" == typeof e.y && (a.style.left = e.x + "px", 
        a.style.top = e.y + "px", a.style.right = "auto");
        let i = a.offsetWidth, s = a.offsetHeight, r = (setInterval(() => {
            var e = a.offsetWidth, t = a.offsetHeight;
            e === i && t === s || (i = e, s = t, Ce(be, {
                w: e,
                h: t
            }));
        }, 400), !1), o = 0, n = 0, l = 0, c = 0, t = Re(".comm-head", a);
        var d = e => {
            var t;
            r && (e = "touches" in e ? e.touches[0] : e, t = l + (e.clientX - o), 
            e = c + (e.clientY - n), t = Math.min(window.innerWidth - 12 - a.offsetWidth, Math.max(12, t)), 
            e = Math.min(window.innerHeight - 12 - 40, Math.max(12, e)), a.style.left = t + "px", 
            a.style.top = e + "px", a.style.right = "auto");
        }, h = () => {
            var e;
            r && (r = !1, document.body.style.userSelect = "", e = a.getBoundingClientRect(), 
            Ce(fe, {
                x: e.left,
                y: e.top
            }), window.removeEventListener("mousemove", d), window.removeEventListener("mouseup", h), 
            window.removeEventListener("touchmove", d, {
                passive: !1
            }), window.removeEventListener("touchend", h));
        }, e = e => {
            var t = "touches" in e ? e.touches[0] : e, i = (r = !0, a.getBoundingClientRect());
            o = t.clientX, n = t.clientY, l = i.left, c = i.top, document.body.style.userSelect = "none", 
            window.addEventListener("mousemove", d), window.addEventListener("mouseup", h), 
            window.addEventListener("touchmove", d, {
                passive: !1
            }), window.addEventListener("touchend", h), e.preventDefault();
        }, u = (t.addEventListener("mousedown", e), t.addEventListener("touchstart", e, {
            passive: !1
        }), Array.from(a.querySelectorAll(".comm-tab"))), B = Array.from(a.querySelectorAll(".panel")), O = t => {
            u.forEach(e => e.classList.toggle("active", e.dataset.tab === t)), B.forEach(e => e.classList.toggle("active", e.dataset.panel === t)), 
            Ce(ye, t);
        };
        u.forEach(e => e.addEventListener("click", () => O(e.dataset.tab)));
        let p = Ae(ye, "program");
        "debug" === p && (p = "options"), O(p);
        var $ = Re("#grc-active", a), m = Re("#grc-stby", a), e = Re("#grc-knob", a), G = Re("#grc-swap", a), N = Re("#grc-state", a), H = Re("#grc-lamp-tx", a), q = Re("#grc-lamp-rx", a), W = Re("#grc-ptt-display", a), z = Re("#grc-ptt-bind", a), U = Re("#grc-ptt-clear", a);
        let g = Ae(we, {
            code: null
        }), v = !1;
        function f() {
            var e;
            W.value = (e = g.code) ? e.startsWith("Key") ? e.slice(3) : e.startsWith("Digit") ? e.slice(5) : {
                Space: "Space",
                Minus: "-",
                Equal: "=",
                BracketLeft: "[",
                BracketRight: "]",
                Backslash: "\\",
                Semicolon: ";",
                Quote: "'",
                Comma: ",",
                Period: ".",
                Slash: "/",
                Backquote: "`",
                ArrowUp: "ArrowUp",
                ArrowDown: "ArrowDown",
                ArrowLeft: "ArrowLeft",
                ArrowRight: "ArrowRight",
                ShiftLeft: "Shift",
                ShiftRight: "Shift",
                ControlLeft: "Ctrl",
                ControlRight: "Ctrl",
                AltLeft: "Alt",
                AltRight: "Alt",
                MetaLeft: "Meta",
                MetaRight: "Meta",
                CapsLock: "CapsLock",
                Tab: "Tab",
                Escape: "Esc",
                Enter: "Enter",
                Backspace: "Backspace"
            }[e] || e : "Unbound";
        }
        f(), z.addEventListener("click", function() {
            var t;
            v || (v = !0, W.value = "Press any key… (Esc to cancel)", t = e => {
                e.preventDefault(), e.stopPropagation(), v = ("Escape" === e.code || (g = {
                    code: e.code || null
                }, Ce(we, g)), !1), f(), window.removeEventListener("keydown", t, !0);
            }, window.addEventListener("keydown", t, !0));
        }), U.addEventListener("click", function() {
            P = !1, M(), g = {
                code: null
            }, Ce(we, g), f();
        });
        var b = Re("#grc-ptt-typing", a);
        let y = !!Ae(Te, !1);
        b.checked = y, b.addEventListener("change", () => {
            y = !!b.checked, Ce(Te, y);
        });
        var x = Re("#grc-pttblip", a), j = Re("#grc-pttblip-val", a);
        let w = Math.max(0, Math.min(200, Number(Ae(Se, 90)) || 90));
        function Q(e) {
            w = Math.max(0, Math.min(200, Number(e) || 0)), j.textContent = w + " ms", 
            Ce(Se, w);
            try {
                window.radio?.setPttBlip?.(w);
            } catch {}
        }
        x.value = String(w), j.textContent = w + " ms", Q(w), x.addEventListener("input", () => Q(x.value)), 
        Re("#grc-reset-ui", a).addEventListener("click", () => {
            try {
                localStorage.removeItem(fe), localStorage.removeItem(be);
            } catch {}
            a.style.left = "", a.style.top = "", a.style.right = "40px", a.style.top = "120px", 
            Me("Window layout reset.");
        });
        var X = Re("#grc-joy-display", a), z = Re("#grc-joy-bind", a), U = Re("#grc-joy-clear", a);
        let _ = Ae(ke, {
            type: null
        });
        function T() {
            var e, t;
            X.value = (e = _) && e.type ? (t = e.padId ? `"${e.padId.slice(0, 24)}"` : "#" + (e.padIndex ?? "?"), 
            "button" === e.type ? `Pad ${t} • Button ` + e.button : "axis" === e.type ? `Pad ${t} • Axis ${e.axis} (${0 < e.sign ? "+" : "−"})` : "Unbound") : "Unbound";
        }
        function S() {
            try {
                return navigator.getGamepads && navigator.getGamepads() || [];
            } catch {
                return [];
            }
        }
        T();
        let k = !1;
        z.addEventListener("click", function() {
            if (!k) {
                k = !0, X.value = "Press a button or move a trigger… (Esc to cancel)";
                var t = () => {
                    k = !1, T(), window.removeEventListener("keydown", d, !0);
                }, d = e => {
                    "Escape" === e.code && (e.preventDefault(), e.stopPropagation(), 
                    t());
                };
                window.addEventListener("keydown", d, !0);
                let c = null;
                c = function() {
                    var t = S(), i = [];
                    for (let e = 0; e < t.length; e++) {
                        var a = t[e];
                        a && a.connected && (i[e] = {
                            id: a.id || "",
                            buttons: a.buttons.map(e => ({
                                pressed: !!e.pressed,
                                value: Number(e.value) || 0
                            })),
                            axes: a.axes.slice()
                        });
                    }
                    return i;
                }(), requestAnimationFrame(function e() {
                    if (k) {
                        var i = S();
                        for (let t = 0; t < i.length; t++) {
                            var a = i[t];
                            if (a && a.connected) {
                                var s = c[t];
                                for (let e = 0; e < (a.buttons?.length || 0); e++) if (o = a.buttons[e]) {
                                    var r = Number(o.value) || 0, o = !!o.pressed || .5 <= r, r = !!(l = s?.buttons?.[e])?.pressed || .5 <= (Number(l?.value) || 0);
                                    if (o && !r) return _ = {
                                        type: "button",
                                        padId: a.id ? String(a.id).slice(0, 60) : "",
                                        padIndex: t,
                                        button: e,
                                        thresholdBtn: .5
                                    }, Ce(ke, _), k = !1, T(), void window.removeEventListener("keydown", d, !0);
                                }
                                for (let e = 0; e < (a.axes?.length || 0); e++) {
                                    var n = Number(a.axes[e]) || 0, l = Number((s?.axes || [])[e]) || 0;
                                    if (.6 <= Math.abs(n) && Math.abs(l) < .6) return _ = {
                                        type: "axis",
                                        padId: a.id ? String(a.id).slice(0, 60) : "",
                                        padIndex: t,
                                        axis: e,
                                        sign: 0 <= n ? 1 : -1,
                                        thresholdOn: .6,
                                        thresholdOff: .4
                                    }, Ce(ke, _), k = !1, T(), void window.removeEventListener("keydown", d, !0);
                                }
                            }
                        }
                        requestAnimationFrame(e);
                    }
                });
            }
        }), U.addEventListener("click", function() {
            R = !1, M(), _ = {
                type: null
            }, Ce(ke, _), T();
        }), window.addEventListener("gamepadconnected", () => T()), window.addEventListener("gamepaddisconnected", () => T());
        let P = !1, R = !1, Y = !1;
        function M() {
            var e = P || R;
            if (e !== Y) {
                Y = e;
                try {
                    e ? window.radio?.pttDown?.() : window.radio?.pttUp?.();
                } catch {}
            }
        }
        window.__georadioPTTHandlers || (window.addEventListener("keydown", e => {
            !g?.code || v || !y && function(e) {
                var t;
                if (e) return t = (e.tagName || "").toUpperCase(), e.isContentEditable || "INPUT" === t || "TEXTAREA" === t || "SELECT" === t;
            }(document.activeElement) || e.code === g.code && (e.repeat ? e.preventDefault() : (P = !0, 
            M(), e.preventDefault(), e.stopPropagation()));
        }, !0), window.addEventListener("keyup", e => {
            g?.code && !v && e.code === g.code && (P = !1, M(), e.preventDefault(), 
            e.stopPropagation());
        }, !0), requestAnimationFrame(function e() {
            if (_ && _.type) {
                let e = function(e) {
                    var t = S();
                    if (t) {
                        if (e?.padId) for (var i of t) if (i && i.id && i.connected && String(i.id).includes(e.padId)) return i;
                        if (Number.isInteger(e?.padIndex) && (i = t[e.padIndex]) && i.connected) return i;
                        for (i of t) if (i && i.connected) return i;
                    }
                    return null;
                }(_), t = !1, i, a, s, r, o;
                e && ("button" === _.type ? (i = e.buttons?.[_.button], a = Number(i?.value) || 0, 
                t = !!i?.pressed || a >= (_.thresholdBtn ?? .5)) : "axis" === _.type && (s = (Number(e.axes?.[_.axis]) || 0) * (_.sign || 1), 
                r = _.thresholdOn ?? .6, o = _.thresholdOff ?? .4, t = R ? o <= s : r <= s)), 
                t !== R && (R = t, M());
            }
            requestAnimationFrame(e);
        }), window.__georadioPTTHandlers = !0);
        var J = .012, K = 400, V = new Map();
        function Z(e) {
            var t = Date.now(), i = function(e) {
                var t = window.radio, i = t?.audio?.fx?.get?.(e);
                if (i && "number" == typeof i._lastRMS) return i._lastRMS || 0;
                try {
                    var a = t?.peers?.get?.(e)?.rxReceiver?.getSynchronizationSources?.();
                    if (a && a.length) return a[0].audioLevel ?? 0;
                } catch {}
                return 0;
            }(e);
            return J < i && V.set(e, t), t - (V.get(e) || 0) < K;
        }
        let A = Number(Ae(xe, 121.5));
        function C(e) {
            var t;
            A = (t = e, t = .025 * Math.round(e / .025), e = Number(t.toFixed(3)), 
            Math.min(136.975, Math.max(118, Number(e) || 118))), m.value = Ee(A), 
            Ce(xe, A);
        }
        function ee() {
            var e = window.radio;
            return e ? Number(e.freqMHz || 121.5) : 121.5;
        }
        function te() {
            $.value = Ee(ee());
        }
        let E = null;
        function ie(e) {
            var t = "touches" in e ? e.touches[0] : e;
            E = {
                startY: t.clientY,
                accPx: 0,
                angle: 0,
                target: "stby"
            }, e.preventDefault();
        }
        function ae(e) {
            var t, i;
            E && (t = "touches" in e ? e.touches[0] : e, t = E.startY - t.clientY - E.accPx, 
            0 !== (t = Math.trunc(t / 8)) && ("stby" === E.target && (C(A + .025 * t), 
            i = Re("#grc-knob")) && (E.angle += 6 * t, i.style.transform = `translateY(-50%) rotate(${E.angle}deg)`), 
            E.accPx += 8 * t), e.preventDefault());
        }
        function se() {
            E = null;
        }
        e.addEventListener("mousedown", e => {
            E = null, ie(e);
        }), window.addEventListener("mousemove", ae), window.addEventListener("mouseup", se), 
        e.addEventListener("touchstart", e => {
            E = null, ie(e);
        }, {
            passive: !1
        }), window.addEventListener("touchmove", ae, {
            passive: !1
        }), window.addEventListener("touchend", se), m.addEventListener("change", () => {
            var e = parseFloat(m.value);
            isFinite(e) ? C(e) : m.value = Ee(A);
        }), G.addEventListener("click", function() {
            var e, t, i = window.radio;
            i && (e = A, t = ee(), i.tune(e), C(t), te());
        });
        var re = Re("#grc-vol", a), L = Re("#grc-volknob", a);
        let I = Math.max(0, Math.min(1, Number(Ae(_e, 1))));
        function oe(e) {
            return Math.round(100 * e);
        }
        function ne(e) {
            I = Math.max(0, Math.min(1, Number(e) || 0)), re.value = oe(I) + "%", 
            Ce(_e, I), ce();
        }
        ne(I);
        let le = !1;
        function ce() {
            try {
                var e, t = window.radio;
                t?.audio?.rxBus && (e = !!t.audio.rxGateOpen, t.audio.rxBus.gain.value = e ? I : 0);
            } catch {}
        }
        let F = null;
        function de(e) {
            var t = "touches" in e ? e.touches[0] : e;
            F = {
                startY: t.clientY,
                accPx: 0,
                angle: 0
            }, e.preventDefault();
        }
        function he(e) {
            var t;
            F && (t = "touches" in e ? e.touches[0] : e, t = F.startY - t.clientY - F.accPx, 
            0 !== (t = Math.trunc(t / 6)) && (ne(I + .02 * t), F.accPx += 6 * t, 
            F.angle += 6 * t, L.style.transform = `translateY(-50%) rotate(${F.angle}deg)`), 
            e.preventDefault());
        }
        function ue() {
            F = null;
        }
        L.addEventListener("mousedown", de), window.addEventListener("mousemove", he), 
        window.addEventListener("mouseup", ue), L.addEventListener("touchstart", de, {
            passive: !1
        }), window.addEventListener("touchmove", he, {
            passive: !1
        }), window.addEventListener("touchend", ue);
        var D = Re("#grc-peers", a);
        function pe(e, t) {
            var i = window.radio;
            if (i) {
                t ? Pe.add(e) : Pe.delete(e);
                var a = i.audio?.rx?.get?.(e);
                if (a && !i.audio.fxEnabled) try {
                    a.volume = t ? 0 : 1;
                } catch {}
                if (i.audio?.fxEnabled) {
                    a = i.audio.fx.get(e);
                    if (a && a.sum) try {
                        if (!a._muteGain) {
                            var s = i.audio.ctx.createGain();
                            s.gain.value = 1;
                            try {
                                a.sum.disconnect(i.audio.rxBus);
                            } catch {}
                            a.sum.connect(s), s.connect(i.audio.rxBus), a._muteGain = s;
                        }
                        a._muteGain.gain.value = t ? 0 : 1;
                    } catch {}
                }
            }
        }
        function me() {
            var e = window.radio;
            if (e && e.peers) {
                e = [ ...e.peers.keys() ];
                if (e.length) {
                    D.innerHTML = e.map(e => {
                        return `<tr data-pid="${e}">
          <td><code>${e}</code></td>
          <td>${function(e) {
                            try {
                                return !!window.radio?.peers?.get?.(e)?.connected;
                            } catch {
                                return !1;
                            }
                        }(e) ? '<span class="badge conn">connected</span>' : '<span class="badge">linking</span>'}</td>
          <td>${function(e) {
                            try {
                                return Z(e) ? '<span class="badge tx">TX</span>' : '<span class="badge">idle</span>';
                            } catch {
                                return '<span class="badge">idle</span>';
                            }
                        }(e)}</td>
          <td><label><input type="checkbox" class="grc-mute" ${Pe.has(e) ? "checked" : ""}> mute</label></td>
        </tr>`;
                    }).join(""), D.querySelectorAll("input.grc-mute").forEach(e => {
                        var t = e.closest("tr")?.dataset?.pid;
                        e.addEventListener("change", () => pe(t, e.checked));
                    });
                    try {
                        var t = window.radio;
                        if (t) for (var i of t.peers.keys()) pe(i, Pe.has(i));
                    } catch {}
                } else D.innerHTML = '<tr><td colspan="4" class="muted">No peers</td></tr>';
            } else D.innerHTML = '<tr><td colspan="4" class="muted">No radio</td></tr>';
        }
        return setInterval(() => {
            var e = window.radio;
            try {
                e && !e.audio?.fxEnabled && e.setDegrade(!0);
            } catch {}
            try {
                var t, i = window.radio;
                i?.audio && !le && "function" == typeof (t = i.audio.setRxGate?.bind(i.audio)) && (i.audio.setRxGate = function(e) {
                    t(e);
                    try {
                        this.rxBus.gain.value = e ? I : 0;
                    } catch {}
                }, le = !0);
            } catch {}
            ce();
            let a = !!e?.enabled, s = e?.roomId || "—", r = e?.id || "—", o = e?.peers ? [ ...e.peers.keys() ].length : 0, n = (N.textContent = a ? `ON • ID ${r} • ${s} • peers:` + o : "OFF • ID " + r, 
            te(), document.activeElement !== m && (m.value = Ee(A)), re.value = oe(I) + "%", 
            !(!e?.ptt && !e?._txHold)), l = !1;
            try {
                if (e?.peers) for (var c of e.peers.keys()) if (!Pe.has(c) && Z(c)) {
                    l = !0;
                    break;
                }
            } catch {}
            H.classList.toggle("on", n), q.classList.toggle("on", l), me();
        }, 200), Re(".comm-close", a).addEventListener("click", e => {
            e.stopPropagation(), a.classList.remove("open");
            e = document.getElementById(ge);
            e && e.classList.remove("blue-pad");
        }), a;
    }
    function l() {
        var e, t, i, a, s;
        function r() {
            try {
                var e = t.getBoundingClientRect();
                i.style.top = e.bottom + 6 + "px", i.style.left = e.left + "px";
            } catch {}
        }
        document.getElementById(ge) || ((e = document.querySelector(".geofs-ui-right")) && (t = e.querySelector(".geofs-radio-pad.control-pad") || e.querySelector(".geofs-radio-pad")) ? ((i = document.createElement("div")).className = "control-pad geofs-comm-pad", 
        i.id = ge, i.setAttribute("tabindex", "0"), i.innerHTML = '<div class="control-pad-label transp-pad">COMM</div>', 
        e.appendChild(i), r(), window.addEventListener("resize", r), new MutationObserver(r).observe(document.documentElement, {
            attributes: !0,
            subtree: !0,
            childList: !0
        }), a = n(), i.addEventListener("click", s = () => {
            a.classList.add("open"), i.classList.add("blue-pad");
        }), i.addEventListener("keydown", e => {
            "Enter" !== e.key && " " !== e.key || (e.preventDefault(), s());
        }), new MutationObserver(() => {
            a.classList.contains("open") || i.classList.remove("blue-pad");
        }).observe(a, {
            attributes: !0,
            attributeFilter: [ "class" ]
        }), Me("COMM pad injected (below RADIO).")) : setTimeout(l, 600));
    }
    document.getElementById(r) || (e = `
#${ge}{
  width:50px; height:80px; position:fixed;
  z-index:99999; cursor:pointer; user-select:none;
}
#${ge} .control-pad-label{
  writing-mode: vertical-rl; text-orientation: upright;
  letter-spacing:1px; line-height:1.05; font-weight:600;
  width:100%; height:100%; display:grid; place-items:center;
}

#${ve}{
  position: fixed;
  top: 120px; right: 40px;
  width: 520px; height: 400px;
  min-width: 380px; min-height: 260px;
  background: rgba(18,22,28,0.94);
  color: #e6edf3;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.35);
  z-index: 100000;
  font-family: system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Helvetica Neue,Arial,Noto Sans;
  display:none;
  resize: both; overflow: auto;
}
#${ve}.open{ display:block; }

#${ve} .comm-head{
  cursor:move; padding:10px 12px;
  background:linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
  border-bottom:1px solid rgba(255,255,255,0.12);
  border-top-left-radius:8px; border-top-right-radius:8px;
  display:flex; align-items:center; gap:10px;
}
#${ve} .comm-title{ font-weight:700; font-size:13px; letter-spacing:.35px; text-transform:uppercase; opacity:.94; }
#${ve} .comm-spacer{ flex:1; }
#${ve} .comm-close{
  background:transparent; color:#e6edf3; border:0; font-size:16px; line-height:1;
  width:28px; height:28px; border-radius:6px; cursor:pointer;
}
#${ve} .comm-close:hover{ background:rgba(255,255,255,0.08); }

#${ve} .comm-tabs{ display:flex; gap:6px; padding:8px 8px 0 8px; flex-wrap:wrap; align-items:center; }
#${ve} .comm-tab{
  background:rgba(255,255,255,0.06);
  color:#e6edf3; border:1px solid rgba(255,255,255,0.10);
  border-radius:6px; padding:6px 10px; font-size:12px; cursor:pointer;
}
#${ve} .comm-tab.active{ background:#2b82f6; border-color:#2b82f6; }

#${ve} .lampbar { margin-left:auto; display:flex; gap:10px; align-items:center; }
#${ve} .lamp { display:flex; align-items:center; gap:6px; font-size:11px; opacity:.9; }
#${ve} .dot { width:12px; height:12px; border-radius:50%; background:#334155; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.15); }
#${ve} .dot.tx.on { background:#22c55e; animation: pulseGreen 0.9s infinite; }
#${ve} .dot.rx.on { background:#3b82f6; animation: pulseBlue 0.9s infinite; }
@keyframes pulseGreen { 0%,100%{filter:brightness(0.9)} 50%{filter:brightness(1.6)} }
@keyframes pulseBlue  { 0%,100%{filter:brightness(0.9)} 50%{filter:brightness(1.6)} }

#${ve} .comm-body{ padding:10px 12px; font-size:12px; }
#${ve} .panel{ display:none; }
#${ve} .panel.active{ display:block; }

.grc-stack { display:grid; grid-template-columns: 1fr; gap:12px; }
.grc-line { display:grid; grid-template-columns: 110px 1fr; gap:10px; align-items:center; }
.grc-label { opacity:.85; text-transform:uppercase; font-weight:700; letter-spacing:.5px; font-size:11px; }

.grc-field { position:relative; }
.grc-field input.geofs-radio-display {
  width:90%; padding:6px 8px; font-weight:700;
  background: rgba(255,255,255,0.06);
  color:#e6edf3;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 6px;
}

.grc-standby-wrap, .grc-volume-wrap { position:relative; padding-right:46px; display:flex; align-items:center; justify-content:center; }
.grc-knob {
  position:absolute; right:6px; top:50%; transform:translateY(-50%) rotate(0deg);
  width:34px; height:34px; border-radius:50%;
  background-image:url("images/instruments/radioknob.png");
  background-size:34px 34px; background-repeat:no-repeat; background-position:center;
  cursor:ns-resize; user-select:none;
  box-shadow: 0 0 0 1px rgba(255,255,255,0.12), 0 4px 10px rgba(0,0,0,0.35);
}

.grc-swap-bar { display:flex; justify-content:center; }
.grc-swap, .grc-btn {
  background:#2b82f6; color:#fff; border:0; border-radius:6px; padding:7px 10px; cursor:pointer; font-weight:700;
}

#${ve} table{ width:100%; border-collapse:collapse; font-size:12px; }
#${ve} th, #${ve} td{ padding:6px 6px; border-bottom:1px solid rgba(255,255,255,0.08); }
#${ve} th{ text-align:left; opacity:.8; font-weight:600; }
#${ve} .muted{ opacity:.6; }
#${ve} .badge{ display:inline-block; padding:2px 6px; border-radius:10px; font-size:11px; line-height:1; background:rgba(255,255,255,0.10); }
#${ve} .badge.tx{ background:#eab308; color:#0b0b0b; }
#${ve} .badge.conn{ background:#22c55e; color:#0b0b0b; }
#${ve} small.hint { opacity:.7; }
#${ve} .opt-row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
`, (t = document.createElement("style")).id = r, t.textContent = e, document.head.appendChild(t)), 
    (a = () => {
        return !!document.querySelector(".geofs-ui-right") && (l(), !0);
    })() || ((i = new MutationObserver(() => {
        a() && i.disconnect();
    })).observe(document.documentElement, {
        childList: !0,
        subtree: !0
    }), setTimeout(l, 1500)), Me("Loaded", "v_beta_1.0");
    var c = setInterval(() => {
        var e, t;
        document.getElementById(ve) && (clearInterval(c), t = Number(Ae(xe, 121.5)), 
        (e = document.querySelector("#grc-stby")) && (e.value = Ee(t)), e = document.querySelector("#grc-vol")) && (t = Math.max(0, Math.min(1, Number(Ae(_e, 1)))), 
        e.value = Math.round(100 * t) + "%");
    }, 300);
})();
