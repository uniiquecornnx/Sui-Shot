var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var _a, _b, _c;
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
var extraAllowedHosts = (((_c = (_b = (_a = globalThis.process) === null || _a === void 0 ? void 0 : _a.env) === null || _b === void 0 ? void 0 : _b.VITE_ALLOWED_HOSTS) !== null && _c !== void 0 ? _c : '')
    .split(',')
    .map(function (v) { return v.trim(); })
    .filter(Boolean));
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        host: true,
        allowedHosts: __spreadArray(['sui-shot.onrender.com', '.onrender.com'], extraAllowedHosts, true),
    },
});
