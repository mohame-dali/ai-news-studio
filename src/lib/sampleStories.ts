import { ArticleSourceData, ManuscriptType } from "@/types";

export const sampleNewsStories: Record<string, ManuscriptType> = {
  "arctic-climate-summit": {
    meta: {
      title: "Climat : Une anomalie thermique historique enregistrée par la station du Spitzberg",
      pubdate: new Date().toISOString(),
      byline: "Rédaction Internationale / Agence France-Presse",
      articleUrl: "arctic-climate-summit",
      uniqueId: "tab-arctic-climate-summit",
      audio: {
        src: "https://actions.google.com/sounds/v1/weather/wind_arctic_cold.ogg",
      },
    },
    segments: [
      {
        id: 101,
        type: "segment",
        mood: "dramatic",
        style: "bottom",
        cameraMovement: "zoom-in",
        text: "Des températures records de douze degrés au-dessus des normales ont été mesurées ce matin.",
        texts: [
          {
            type: "text",
            line_id: 1,
            text: "Des températures records de douze degrés au-dessus des normales ont été mesurées ce matin.",
            who: "default",
            start: 0,
            end: 4.8,
            displayText: "Des températures records de douze degrés au-dessus des normales ont été mesurées ce matin.",
          },
        ],
        mainMedia: {
          type: "image",
          url: "https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?auto=format&fit=crop&w=1200&q=80",
          byline: "Institut Polaire / Svalbard",
          description: "Vue panoramique de la banquise côtière et des glaciers arctiques",
          imageAsset: {
            id: "arctic-glacier-1",
            size: { width: 1200, height: 800 },
          },
          hotspot: {
            x: 200,
            y: 100,
            width: 800,
            height: 600,
            x_norm: 0.16,
            y_norm: 0.12,
            width_norm: 0.66,
            height_norm: 0.75,
          },
        },
        start: 0,
        end: 4.8,
      },
      {
        id: 102,
        type: "segment",
        mood: "neutral",
        style: "middle",
        cameraMovement: "pan-right",
        text: "L'avant-poste de recherche de Ny-Ålesund [Nee-Oh-le-sund] confirme un recul côtier accéléré.",
        texts: [
          {
            type: "text",
            line_id: 2,
            text: "L'avant-poste de recherche de Ny-Ålesund confirme un recul côtier accéléré.",
            who: "default",
            start: 4.8,
            end: 9.6,
            displayText: "L'avant-poste de recherche de Ny-Ålesund confirme un recul côtier accéléré.",
          },
        ],
        mainMedia: {
          type: "map",
          byline: "Cartographie / Données OpenStreetMap",
          location: {
            lat: 78.9235,
            lon: 11.9099,
            zoomStart: 5,
            zoomEnd: 7,
          },
        },
        start: 4.8,
        end: 9.6,
      },
      {
        id: 103,
        type: "segment",
        mood: "hopeful",
        style: "bottom",
        cameraMovement: "zoom-out",
        text: "Les équipes océanographiques déploient des sondes sous-marines autonomes pour surveiller les courants profonds.",
        texts: [
          {
            type: "text",
            line_id: 3,
            text: "Les équipes océanographiques déploient des sondes sous-marines autonomes pour surveiller les courants profonds.",
            who: "default",
            start: 9.6,
            end: 14.8,
            displayText: "Les équipes océanographiques déploient des sondes sous-marines autonomes pour surveiller les courants profonds.",
          },
        ],
        mainMedia: {
          type: "video",
          url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
          byline: "Mission Océanographique Internationale",
          description: "Navire de recherche polaire manœuvrant en haute mer",
          startFrom: 1,
          endAt: 7,
          videoAsset: {
            id: "video-glider-deploy",
            title: "Déploiement des sondes océanographiques",
            duration: 15,
            streamUrls: {
              mp4: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
            },
          },
        },
        start: 9.6,
        end: 14.8,
      },
    ],
  },
  "mars-water-discovery": {
    meta: {
      title: "Espace : Détection formelle d'eau liquide salée sous la calotte australe de Mars",
      pubdate: new Date().toISOString(),
      byline: "Bureau Scientifique & Spatial / AFP",
      articleUrl: "mars-water-discovery",
      uniqueId: "tab-mars-water-discovery",
    },
    segments: [
      {
        id: 201,
        type: "segment",
        mood: "dramatic",
        style: "bottom",
        cameraMovement: "zoom-in",
        text: "Les radars orbitaux confirment l'existence de réservoirs sous pression à vingt kilomètres de profondeur.",
        texts: [
          {
            type: "text",
            line_id: 1,
            text: "Les radars orbitaux confirment l'existence de réservoirs sous pression à vingt kilomètres de profondeur.",
            who: "default",
            start: 0,
            end: 5.0,
            displayText: "Les radars orbitaux confirment l'existence de réservoirs sous pression à vingt kilomètres de profondeur.",
          },
        ],
        mainMedia: {
          type: "image",
          url: "https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?auto=format&fit=crop&w=1200&q=80",
          byline: "Agence Spatiale Européenne / Données Mars Express",
          description: "Topographie martienne révélant les vallées du pôle sud",
          imageAsset: {
            id: "mars-orbit-1",
            size: { width: 1200, height: 800 },
          },
          hotspot: {
            x: 250,
            y: 150,
            width: 700,
            height: 500,
            x_norm: 0.2,
            y_norm: 0.18,
            width_norm: 0.58,
            height_norm: 0.62,
          },
        },
        start: 0,
        end: 5.0,
      },
      {
        id: 202,
        type: "segment",
        mood: "hopeful",
        style: "top",
        cameraMovement: "pan-left",
        text: "Cette découverte relance la recherche de biosignatures microbiennes fossiles ou actives sur la planète rouge.",
        texts: [
          {
            type: "text",
            line_id: 2,
            text: "Cette découverte relance la recherche de biosignatures microbiennes fossiles ou actives sur la planète rouge.",
            who: "default",
            start: 5.0,
            end: 9.8,
            displayText: "Cette découverte relance la recherche de biosignatures microbiennes fossiles ou actives sur la planète rouge.",
          },
        ],
        mainMedia: {
          type: "image",
          url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80",
          byline: "Revue d'Astrophysique & Sciences Planétaires",
          description: "Vue d'artiste des strates géologiques martiennes et atmosphère ténue",
          imageAsset: {
            id: "mars-rover-lab",
            size: { width: 1200, height: 800 },
          },
        },
        start: 5.0,
        end: 9.8,
      },
    ],
  },
};

export const sampleSourceArticles: Record<string, ArticleSourceData> = {
  "arctic-climate-summit": {
    title: "Climat : Une anomalie thermique historique enregistrée par la station du Spitzberg",
    publisher: "Agence France-Presse (AFP)",
    author: "Claire Beauchamp, envoyée spéciale au Svalbard",
    pubdate: "2026-10-31T08:30:00Z",
    url: "https://www.afp.com/fr/depeches/climat-spitzberg-anomalie-thermique-2026",
    importedAt: "2026-11-01T07:15:00Z",
    fetcherId: "ap",
    content: `LONGYEARBYEN (Norvège) — Une anomalie thermique sans précédent a été constatée par les capteurs de l'institut océanographique de Ny-Ålesund, dans l'archipel du Svalbard.

Des températures records de douze degrés au-dessus des normales saisonnières ont été mesurées ce matin par les équipes scientifiques internationales en poste dans l'Arctique. L'avant-poste de recherche de Ny-Ålesund confirme un recul côtier accéléré des plaques de glace et une fonte précoce des pergélisols environnants.

Face à cette accélération des bouleversements thermiques, les équipes océanographiques ont entrepris le déploiement immédiat de sondes sous-marines autonomes afin de surveiller les variations de salinité et les courants profonds de la mer de Barents.

Selon le Dr. Erik Lindqvist, directeur des observations boréales, « les données relevées au cours des dernières quarante-huit heures confirment une modification structurelle des échanges thermiques entre l'océan Atlantique et le bassin polaire ». Un rapport complet sera soumis à l'Organisation Météorologique Mondiale d'ici la fin de semaine.`,
  },
  "mars-water-discovery": {
    title: "Espace : Détection formelle d'eau liquide salée sous la calotte australe de Mars",
    publisher: "Revue Européenne d'Astrophysique / AFP",
    author: "Marc Delaunay, rédacteur scientifique",
    pubdate: "2026-10-28T14:00:00Z",
    url: "https://www.esa.int/Science_Exploration/Space_Science/Mars_liquid_water_subsurface",
    importedAt: "2026-11-01T07:20:00Z",
    fetcherId: "reuters",
    content: `PARIS — Les données radar recueillies par la sonde orbitale européenne Mars Express confirment la présence de réservoirs d'eau liquide salée maintenus sous haute pression à vingt kilomètres de profondeur sous la calotte polaire australe de la planète Mars.

Les échos radar analysés conjointement par les équipes de recherche italiennes et françaises démontrent une réflectivité caractéristique d'étendues liquides saturées en perchlorates, empêchant le gel malgré des températures estimées à moins soixante-huit degrés Celsius.

Cette découverte fondamentale relance l'intérêt de la communauté scientifique mondiale pour la recherche de biosignatures microbiennes fossiles ou actives préservées dans les poches hydrothermales profondes de la planète rouge.

« Nous avons désormais des preuves directes que des conditions aqueuses stables ont pu subsister dans le sous-sol martien bien après la disparition des mers de surface », a déclaré la responsable de mission lors du symposium de l'Académie des Sciences.`,
  },
};

