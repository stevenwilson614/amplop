import crypto from "crypto";

const FILES = {
  "001": "Anim1754_-_Museum_of_Natural_History_-_Blue_Whale.jpg",
  "002": "Humpback_stellwagen_edit.jpg",
  "003": "Mother_sperm_whale_and_calve.jpg",
  "004": "Beluga_whale_Delphinapterus_leucas.jpg",
  "005": "Narwhal,_Tavaniutit,_Baffin_Island.jpg",
  "006": "Fin_whale_from_the_vessel_Pacific_Identity.jpg",
  "007": "Eschrichtius_robustus.jpg",
  "008": "Bowhead_Whale_up-close.jpg",
  "009": "North_Atlantic_Right_Whale_with_Calf.jpg",
  "010": "Minke_Whale_(NOAA).jpg",
  "011": "Sei_whale.jpg",
  "012": "Bryde's_whale.jpg",
  "013": "Kogia_breviceps.jpg",
  "014": "Cuviers_beaked_whale.jpg",
  "015": "Blue_Whale_underwater.jpg",
};

function thumb(file, w = 1200) {
  const md5 = crypto.createHash("md5").update(file).digest("hex");
  const enc = encodeURIComponent(file);
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${md5[0]}/${md5.slice(0, 2)}/${enc}/${w}px-${enc}`;
}

const UA = "AmplopWhaleBot/1.0";

for (const [id, file] of Object.entries(FILES)) {
  const url = thumb(file);
  try {
    const res = await fetch(url, { method: "HEAD", headers: { "User-Agent": UA } });
    console.log(id, res.status, file.slice(0, 35));
  } catch (e) {
    console.log(id, "ERR", e.message);
  }
}
