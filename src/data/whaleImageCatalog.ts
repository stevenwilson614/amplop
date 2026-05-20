/** Bundled whale photos in public/whales/ — always load locally (works offline). */

export interface WhaleImageSource {
  local: string;
  primary: string;
  fallback: string;
}

function entry(local: string): WhaleImageSource {
  return { local, primary: local, fallback: local };
}

export const WHALE_IMAGE_CATALOG: Record<string, WhaleImageSource> = {
  "blue-whale-size": entry("001-blue-whale-size.jpg"),
  "humpback-song": entry("002-humpback-song.jpg"),
  "sperm-deep": entry("003-sperm-deep.jpg"),
  "beluga-voice": entry("004-beluga-voice.jpg"),
  "narwhal-tusk": entry("005-narwhal-tusk.jpg"),
  "fin-speed": entry("006-fin-speed.jpg"),
  "gray-migration": entry("007-gray-migration.jpg"),
  "bowhead-age": entry("008-bowhead-age.jpg"),
  "right-plankton": entry("009-right-plankton.jpg"),
  "minke-small": entry("010-minke-small.jpg"),
  "sei-streamlined": entry("011-sei-streamlined.jpg"),
  "brydes-tropical": entry("012-brydes-tropical.jpg"),
  "pygmy-sperm": entry("013-pygmy-sperm.jpg"),
  "cuvier-beaked": entry("014-cuvier-beaked.jpg"),
  "blue-whale-heart": entry("015-blue-whale-heart.jpg"),
};
