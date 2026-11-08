First InciGram Windows x64 debug preview, based on AyuGram Desktop.

Custom light interface and branding, upstream Ghost Mode enabled by default for
new profiles, local deleted-message and edit-history preservation enabled.
Unnecessary badge/translation background requests and remote crash uploads disabled.

This is an unsigned debug preview, not a stable audited release. A Windows runner checked the x64 PE header, product branding and 15-second
startup without an account. Account login and message delivery remain untested.
Ghost Mode does not make Telegram anonymous and cannot recover messages the
client never received. See PRIVACY.md in the source/portable archive.

Source code and upstream copyright/license notices are available in this repository.
Use the portable ZIP if the standalone executable needs adjacent resource files.

Compiled source: https://github.com/asmdawk/InciGram/tree/7608a334ab0b0ebfe1b0ba110a88e0e4e099ea37
Startup check: https://github.com/asmdawk/InciGram/actions/runs/42514033029
