import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import play from 'play-dl'; // MUDANÇA 1: Importa a nova biblioteca

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Configurar FFmpeg
ffmpeg.setFfmpegPath(ffmpegStatic);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('dist'));

// Configurar AssemblyAI
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY || 'sua-chave-aqui';
const ASSEMBLYAI_BASE_URL = 'https://api.assemblyai.com/v2';

// Configurar Multer para upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// =============================================
// FUNÇÕES AUXILIARES (sem alteração)
// =============================================

const convertVideoToAudio = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    const isWav = outputPath.endsWith('.wav');
    
    let command = ffmpeg(inputPath)
      .audioFrequency(16000)
      .audioChannels(1)
      .on('start', (commandLine) => {
        console.log('FFmpeg iniciado:', commandLine);
      })
      .on('progress', (progress) => {
        console.log(`Progresso: ${Math.round(progress.percent || 0)}%`);
      })
      .on('end', () => {
        console.log('Conversão concluída:', outputPath);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('Erro na conversão:', err);
        
        if (!isWav && outputPath.endsWith('.mp3')) {
          console.log('Tentando conversão para WAV...');
          const wavPath = outputPath.replace('.mp3', '.wav');
          convertVideoToAudio(inputPath, wavPath)
            .then(resolve)
            .catch(reject);
        } else {
          reject(err);
        }
      });

    if (isWav) {
      command
        .audioCodec('pcm_s16le')
        .format('wav');
    } else {
      try {
        command
          .audioCodec('libmp3lame')
          .audioBitrate('64k')
          .format('mp3');
      } catch (error) {
        console.log('MP3 não disponível, usando WAV');
        command
          .audioCodec('pcm_s16le')
          .format('wav');
      }
    }

    command.save(outputPath);
  });
};

const cleanupFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('Arquivo removido:', filePath);
    }
  } catch (error) {
    console.error('Erro ao remover arquivo:', filePath, error);
  }
};

const uploadToAssemblyAI = async (filePath) => {
  try {
    console.log('Fazendo upload para AssemblyAI...');
    const fileData = fs.readFileSync(filePath);
    const response = await fetch(`${ASSEMBLYAI_BASE_URL}/upload`, {
      method: 'POST',
      headers: {
        'authorization': ASSEMBLYAI_API_KEY,
        'content-type': 'application/octet-stream'
      },
      body: fileData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro no upload: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Upload concluído:', data.upload_url);
    return data.upload_url;
  } catch (error) {
    console.error('Erro no upload:', error);
    throw error;
  }
};

const startTranscription = async (audioUrl, options = {}) => {
  try {
    console.log('Iniciando transcrição...');
    const transcriptRequest = {
      audio_url: audioUrl,
      language_detection: !options.language || options.language === 'auto',
      punctuate: true,
      format_text: true,
      ...options
    };

    if (options.language && options.language !== 'auto') {
      transcriptRequest.language_code = options.language;
      delete transcriptRequest.language_detection;
    }

    const response = await fetch(`${ASSEMBLYAI_BASE_URL}/transcript`, {
      method: 'POST',
      headers: {
        'authorization': ASSEMBLYAI_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify(transcriptRequest)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro ao iniciar transcrição: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Transcrição iniciada:', data.id);
    return data.id;
  } catch (error) {
    console.error('Erro ao iniciar transcrição:', error);
    throw error;
  }
};

const waitForTranscription = async (transcriptId) => {
  try {
    console.log('Aguardando conclusão da transcrição...');
    while (true) {
      const response = await fetch(`${ASSEMBLYAI_BASE_URL}/transcript/${transcriptId}`, {
        headers: {
          'authorization': ASSEMBLYAI_API_KEY
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao verificar status: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Status da transcrição:', data.status);

      if (data.status === 'completed') {
        console.log('Transcrição concluída!');
        return data;
      } else if (data.status === 'error') {
        throw new Error(`Erro na transcrição: ${data.error}`);
      }

      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  } catch (error) {
    console.error('Erro ao aguardar transcrição:', error);
    throw error;
  }
};

const transcribeAudio = async (filePath, options = {}) => {
  try {
    if (ASSEMBLYAI_API_KEY === 'sua-chave-aqui') {
      return {
        text: `Transcrição simulada usando AssemblyAI para o arquivo: ${path.basename(filePath)}\n\nEsta é uma demonstração. Para funcionar de verdade, você precisa configurar sua chave da AssemblyAI nas variáveis de ambiente.`,
        confidence: 0.95,
        language_code: options.language || 'pt'
      };
    }
    const audioUrl = await uploadToAssemblyAI(filePath);
    const transcriptId = await startTranscription(audioUrl, options);
    const result = await waitForTranscription(transcriptId);
    return {
      text: result.text,
      confidence: result.confidence,
      language_code: result.language_code,
      words: result.words,
      utterances: result.utterances
    };
  } catch (error) {
    console.error('Erro na transcrição:', error);
    throw error;
  }
};

const validateMediaFile = (filePath, originalName) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error('Arquivo não encontrado'));
    }
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      return reject(new Error('Arquivo está vazio'));
    }
    const allowedExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.mp3', '.wav', '.m4a', '.aac', '.flac'];
    const extension = path.extname(originalName).toLowerCase();
    
    if (!allowedExtensions.includes(extension)) {
      return reject(new Error(`Formato não suportado: ${extension}. Formatos aceitos: ${allowedExtensions.join(', ')}`));
    }
    console.log(`Arquivo validado: ${originalName} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
    resolve({
      size: stats.size,
      extension: extension,
      name: originalName
    });
  });
};

const translateText = async (text) => {
  try {
    return `[TRADUÇÃO SIMULADA] ${text}`;
  } catch (error) {
    console.error('Erro na tradução:', error);
    throw new Error('Falha ao traduzir o texto: ' + error.message);
  }
};

const formatText = async (text) => {
  try {
    const formatted = text
      .split(/[.!?]+/)
      .filter(sentence => sentence.trim().length > 0)
      .map(sentence => sentence.trim())
      .join('.\n\n');
    return formatted + '.';
  } catch (error) {
    console.error('Erro na formatação:', error);
    throw new Error('Falha ao formatar o texto: ' + error.message);
  }
};

// =============================================
// ROTAS DA API
// =============================================

// MUDANÇA 2: Rota do YouTube completamente substituída
// Rota para transcrever YouTube com play-dl
app.post('/api/transcribe-youtube', async (req, res) => {
  let audioPath = null;
  let convertedPath = null;

  try {
    const { url, language } = req.body;

    // Validar URL com play-dl
    const validation = await play.validate(url);
    if (validation !== 'yt_video') {
      return res.status(400).json({ 
        error: 'URL do YouTube inválida ou não suportada' 
      });
    }

    console.log('Processando YouTube com play-dl:', url);

    // Baixar áudio do YouTube
    audioPath = `temp_youtube_${Date.now()}.webm`;
    convertedPath = `temp_youtube_${Date.now()}.wav`;

    // Obter informações e a stream do áudio
    const stream = await play.stream(url, {
      discordPlayerCompatibility: true // Opção que ajuda na estabilidade
    });

    const writeStream = fs.createWriteStream(audioPath);
    stream.stream.pipe(writeStream);

    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
      stream.stream.on('error', reject);
    });

    console.log('Áudio baixado, convertendo...');

    // Converter para áudio compatível
    await convertVideoToAudio(audioPath, convertedPath);

    // Transcrever com AssemblyAI
    const transcriptionOptions = {};
    if (language && language !== 'auto') {
      transcriptionOptions.language = language;
    }

    const result = await transcribeAudio(convertedPath, transcriptionOptions);

    res.json({ 
      transcription: result.text,
      confidence: result.confidence,
      language_detected: result.language_code
    });

  } catch (error) {
    console.error('Erro YouTube:', error);
    res.status(500).json({ 
      error: 'Erro ao processar vídeo do YouTube: ' + error.message 
    });
  } finally {
    // Limpar arquivos temporários
    cleanupFile(audioPath);
    cleanupFile(convertedPath);
  }
});


// Rota para transcrever Instagram (sem alteração)
app.post('/api/transcribe-instagram', async (req, res) => {
  try {
    const { url, language } = req.body;
    console.log('Processando Instagram:', url);
    const transcription = `Transcrição simulada do Instagram usando AssemblyAI: ${url}\n\nEsta é uma demonstração. Para Instagram funcionar de verdade, você precisa implementar um downloader específico.`;
    res.json({ 
      transcription,
      confidence: 0.95,
      language_detected: language || 'pt'
    });
  } catch (error) {
    console.error('Erro Instagram:', error);
    res.status(500).json({ 
      error: 'Erro ao processar vídeo do Instagram: ' + error.message 
    });
  }
});

// Rota para upload de arquivo (sem alteração)
app.post('/api/transcribe-file', upload.single('video'), async (req, res) => {
  let convertedPath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }
    const language = req.body.language;
    console.log('Processando arquivo:', req.file.filename);
    try {
      await validateMediaFile(req.file.path, req.file.originalname);
    } catch (error) {
      return res.status(400).json({ 
        error: 'Arquivo inválido: ' + error.message 
      });
    }
    const fileExtension = path.extname(req.file.filename);
    const baseName = path.basename(req.file.filename, fileExtension);
    convertedPath = path.join('uploads', `${baseName}_converted.wav`);
    console.log('Convertendo para áudio...');
    await convertVideoToAudio(req.file.path, convertedPath);
    const transcriptionOptions = {};
    if (language && language !== 'auto') {
      transcriptionOptions.language = language;
    }
    const result = await transcribeAudio(convertedPath, transcriptionOptions);
    res.json({ 
      transcription: result.text,
      confidence: result.confidence,
      language_detected: result.language_code
    });
  } catch (error) {
    console.error('Erro arquivo:', error);
    res.status(500).json({ 
      error: 'Erro ao processar arquivo: ' + error.message 
    });
  } finally {
    cleanupFile(req.file?.path);
    cleanupFile(convertedPath);
  }
});

// Rota para obter idiomas suportados pelo AssemblyAI (sem alteração)
app.get('/api/languages', (req, res) => {
  const languages = [
    { code: 'auto', name: 'Detectar Automaticamente' },
    { code: 'en', name: 'English (Inglês)' },
    { code: 'es', name: 'Español (Espanhol)' },
    { code: 'fr', name: 'Français (Francês)' },
    { code: 'de', name: 'Deutsch (Alemão)' },
    { code: 'it', name: 'Italiano' },
    { code: 'pt', name: 'Português' },
    { code: 'nl', name: 'Nederlands (Holandês)' },
    { code: 'hi', name: 'हिन्दी (Hindi)' },
    { code: 'ja', name: '日本語 (Japonês)' },
    { code: 'zh', name: '中文 (Chinês)' },
    { code: 'fi', name: 'Suomi (Finlandês)' },
    { code: 'ko', name: '한국어 (Coreano)' },
    { code: 'pl', name: 'Polski (Polonês)' },
    { code: 'ru', name: 'Русский (Russo)' },
    { code: 'tr', name: 'Türkçe (Turco)' },
    { code: 'uk', name: 'Українська (Ucraniano)' },
    { code: 'vi', name: 'Tiếng Việt (Vietnamita)' }
  ];
  res.json({ languages });
});

// Rota de health check (sem alteração)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    hasAssemblyAI: !!(ASSEMBLYAI_API_KEY && ASSEMBLYAI_API_KEY !== 'sua-chave-aqui'),
    ffmpegPath: ffmpegStatic,
    service: 'AssemblyAI'
  });
});

// Rota para processar o texto (traduzir e formatar) (sem alteração)
app.post('/api/process-text', async (req, res) => {
  try {
    const { text, shouldTranslate = true, shouldFormat = true } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Texto não fornecido' });
    }
    let processedText = text;
    if (shouldTranslate) {
      processedText = await translateText(processedText);
    }
    if (shouldFormat) {
      processedText = await formatText(processedText);
    }
    res.json({ 
      processedText,
      operations: {
        translated: shouldTranslate,
        formatted: shouldFormat
      }
    });
  } catch (error) {
    console.error('Erro ao processar texto:', error);
    res.status(500).json({ 
      error: 'Erro ao processar texto: ' + error.message 
    });
  }
});

// Servir frontend em produção (sem alteração)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Iniciar servidor (sem alteração)
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📱 Acesse: http://localhost:${PORT}`);
  console.log(`🔧 FFmpeg configurado: ${ffmpegStatic}`);
  console.log(`🤖 AssemblyAI configurado: ${!!(ASSEMBLYAI_API_KEY && ASSEMBLYAI_API_KEY !== 'sua-chave-aqui')}`);
  if (ffmpegStatic) {
    console.log('✅ FFmpeg encontrado e configurado');
  } else {
    console.log('❌ FFmpeg não encontrado - instale manualmente se necessário');
  }
});
