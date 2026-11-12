const cloudinary = 'https://res.cloudinary.com/not5pvxb/image/upload';

export const schoolHeroImages = [
  `${cloudinary}/v1794482275/school-website/oasis-hero/courtyard.jpg`,
  `${cloudinary}/v1794482277/school-website/oasis-hero/classroom.jpg`,
  `${cloudinary}/v1794482278/school-website/oasis-hero/amboseli.jpg`,
] as const;

function photo(
  legacyId: string,
  asset: string,
  caption: string,
  file: string,
  author: string,
  license = 'by-sa/4.0',
) {
  return {
    legacyId,
    url: `${cloudinary}/${asset}`,
    caption,
    author,
    source: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replaceAll(' ', '_'))}`,
    licenseUrl: license.startsWith('publicdomain/')
      ? `https://creativecommons.org/${license}/`
      : `https://creativecommons.org/licenses/${license}/`,
    licenseName: license === 'by-sa/4.0' ? 'CC BY-SA 4.0' : license === 'by/2.0' ? 'CC BY 2.0' : 'CC0 1.0',
  };
}

// Licensed reference photos for demo content. School uploads keep their original URLs.
export const schoolPhotos = {
  campus: photo(
    '1580582932707-520aed937b7b', 'v1794463034/school-website/kenyan-school-stock/campus.jpg',
    'A school campus in Nairobi', 'School-at-Ngong-Road.jpg', 'Peterkariukimutuura',
  ),
  classroom: photo(
    '1503676260728-1c00da094a0b', 'v1794463031/school-website/kenyan-school-stock/classroom.jpg',
    'A teacher and pupil in a Kenyan primary school', 'Kenyan primary school.jpg', 'Abz123m',
  ),
  science: photo(
    '1532094349884-543bc11b234d', 'v1794463118/school-website/kenyan-school-stock/science.jpg',
    'Learning in a Kenyan classroom', 'Teaching the now generation.jpg', 'Bojourakabuka',
  ),
  library: photo(
    '1481627834876-b7833e8f5570', 'v1794463120/school-website/kenyan-school-stock/library.jpg',
    'A pupil reading in the Shela Primary School library, Lamu', 'Student in Shela Primary School Key Library.jpg', 'Queen Asali',
  ),
  sport: photo(
    '1461896836934-ffe607ba8211', 'v1794463124/school-website/kenyan-school-stock/sport.jpg',
    'A tug-of-war in Kilifi, Kenya', 'A tag of war in Kilifi Kenya.jpg', 'Mutuma Kenneth',
  ),
  music: photo(
    '1514320291840-2e0a9bf2a9ae', 'v1794463038/school-website/kenyan-school-stock/music.jpg',
    'A school celebration in Ukunda, Kenya', 'Great opening day with a lot of dancing, poems and good kenyan music (6729964129).jpg', 'SuSanA Secretariat', 'by/2.0',
  ),
  bus: photo(
    '1544620347-c4fd4a3d5957', 'v1794463126/school-website/kenyan-school-stock/bus.jpg',
    'A Kenyan school bus on the A104', 'School bus in Kenya.jpg', 'flightlog', 'by/2.0',
  ),
  graduation: photo(
    '1523050854058-8df90110c9f1', 'v1794463188/school-website/kenyan-school-stock/graduation.jpg',
    'Graduating pupils in Mpika, Zambia', 'Graduating pupils.jpg', 'BR GEORGE SICHONE', 'publicdomain/zero/1.0',
  ),
  children: photo(
    '1509062522246-3755977927d7', 'v1794463006/school-website/kenyan-school-stock/pupils.jpg',
    'Pupils at Kapsabet Highlands Primary School, Kenya', 'Kapsabet Highlands Primary School Students.jpg', 'Brian Rutto',
  ),
  art: photo(
    '1499951360447-b19be8fe80f5', 'v1794463131/school-website/kenyan-school-stock/art.jpg',
    'Children drawing in Mathare, Nairobi', 'Drawing on disposable plates at Mathare slum, Kenya.jpg', 'Xinqing Lu',
  ),
  computer: photo(
    '1497633762265-9d179a990aa6', 'v1794463134/school-website/kenyan-school-stock/computer.jpg',
    'Pupils using a computer in Kenya', 'Girls using a computer in Kenya.jpg', 'Queen Asali',
  ),
  assembly: photo(
    '1577896851231-70ef18881754', 'v1794463136/school-website/kenyan-school-stock/assembly.jpg',
    'Egerton Primary School pupils walking home in Kenya', 'Africa on the move - Thirst for education.jpg', 'Joseph',
  ),
};

export const schoolPhotoCredits = Object.values(schoolPhotos);

const byLegacyId = new Map(schoolPhotoCredits.map((item) => [item.legacyId, item]));
const byUrl = new Map(schoolPhotoCredits.map((item) => [item.url, item]));

export function findStockSchoolPhoto(url: string | null | undefined) {
  if (!url) return undefined;
  const legacyId = /^https:\/\/images\.unsplash\.com\/photo-([^?]+)(?:\?|$)/.exec(url)?.[1];
  return legacyId ? byLegacyId.get(legacyId) : byUrl.get(url);
}

export function homepageHeroImage(configured: string | null | undefined): string {
  return configured && !findStockSchoolPhoto(configured) ? configured : schoolHeroImages[0];
}
