# Artwork and media map

Use this index before adding or replacing visual material. It points to the existing canonical locations so source art, runtime derivatives, test evidence, and presentation exports remain distinct.

| Material | Canonical location | Boundary |
| --- | --- | --- |
| Savortome identity sources and size exports | [Savortome design library](design/savortome/) | Edit the documented master first, then regenerate or deliberately update consumer copies |
| Broader product exploration | [Design concepts](design/concepts/) | References and comparisons, not current runtime assets |
| Web runtime artwork | [Web public assets](apps/web/public/) and [web app icons](apps/web/app/) | Files are addressed by the Next.js app and must retain compatible paths |
| Mobile runtime artwork | [Mobile assets](apps/mobile/assets/) | Files are addressed by Expo configuration and application code |
| Beta screenshots and acceptance evidence | [Beta evidence](docs/beta/) | Historical evidence tied to its recorded build; not a current product gallery or presentation package |
| Selected presentation recording | [Demo video](Demo%20video/README.md) | No approved recording is currently selected |

## Source and consumer copies

The editable identity library belongs under `design/savortome/`. Web and mobile copies remain beside their consumers because their formats, sizes, and import paths differ. Matching artwork in both application trees is therefore an intentional derivative, not another authoring source.

Before replacing a runtime file, record the source file and revision, required dimensions and transparency, affected consumers, and the verification performed after export. Do not infer that a beta screenshot, comparison board, or similarly named file is the current master.

Keep raw conversations, customer media, credentials, mutable data, build output, and temporary captures outside Git. Large approved presentation recordings belong in Git LFS only after storage impact is reviewed.
