import express from 'express';
import cors from 'cors';
import multer from 'multer';
import ytdl from '@distube/ytdl-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';

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
// FUNÇÕES AUXILIARES
// =============================================

// Função para converter vídeo para áudio (WAV ou MP3)
const convertVideoToAudio = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    const isWav = outputPath.endsWith('.wav');
    
    let command = ffmpeg(inputPath)
      .audioFrequency(16000) // 16kHz é ideal para transcrição
      .audioChannels(1) // Mono para reduzir tamanho
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
        
        // Se falhar, tentar com WAV como fallback
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
      // WAV é mais universal e sempre funciona
      command
        .audioCodec('pcm_s16le')
        .format('wav');
    } else {
      // Tentar MP3 primeiro, com fallback para WAV
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

// Função para limpar arquivos temporários
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

// Função para fazer upload do arquivo para AssemblyAI
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

// Função para iniciar transcrição no AssemblyAI
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

    // Se um idioma específico foi fornecido, usar ele
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

// Função para aguardar conclusão da transcrição
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

      // Aguardar 3 segundos antes de verificar novamente
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  } catch (error) {
    console.error('Erro ao aguardar transcrição:', error);
    throw error;
  }
};

// Função para transcrever áudio completa
const transcribeAudio = async (filePath, options = {}) => {
  try {
    if (ASSEMBLYAI_API_KEY === 'sua-chave-aqui') {
      // Simulação para demonstração
      return {
        text: `Transcrição simulada usando AssemblyAI para o arquivo: ${path.basename(filePath)}\n\nEsta é uma demonstração. Para funcionar de verdade, você precisa:\n1. Configurar sua chave da AssemblyAI\n2. Adicionar ASSEMBLYAI_API_KEY nas variáveis de ambiente\n\nO arquivo foi processado e convertido com sucesso. Esta seria a transcrição real do áudio usando a API do AssemblyAI.`,
        confidence: 0.95,
        language_code: options.language || 'pt'
      };
    }

    // Fazer upload do arquivo
    const audioUrl = await uploadToAssemblyAI(filePath);
    
    // Iniciar transcrição
    const transcriptId = await startTranscription(audioUrl, options);
    
    // Aguardar conclusão
    const result = await waitForTranscription(transcriptId);
    
    return {
      text: result.text,
      confidence: result.confidence,
      language_code: result.language_code,
      words: result.words, // Inclui timestamps das palavras
      utterances: result.utterances // Inclui separação por falante se disponível
    };
  } catch (error) {
    console.error('Erro na transcrição:', error);
    throw error;
  }
};

// Função simplificada para validar arquivo
const validateMediaFile = (filePath, originalName) => {
  return new Promise((resolve, reject) => {
    // Verificar se o arquivo existe
    if (!fs.existsSync(filePath)) {
      return reject(new Error('Arquivo não encontrado'));
    }

    // Verificar tamanho do arquivo
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      return reject(new Error('Arquivo está vazio'));
    }

    // Verificar extensão do arquivo
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

// Função para traduzir texto (mantida do código original)
const translateText = async (text) => {
  try {
    // Usando AssemblyAI não temos tradução integrada, então simulamos ou usamos outro serviço
    // Por enquanto, vamos simular a tradução
    return `[TRADUÇÃO SIMULADA] ${text}`;
  } catch (error) {
    console.error('Erro na tradução:', error);
    throw new Error('Falha ao traduzir o texto: ' + error.message);
  }
};

// Função para formatar texto (mantida do código original)
const formatText = async (text) => {
  try {
    // Formatação básica usando o próprio texto
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

// Rota para transcrever YouTube
app.post('/api/transcribe-youtube', async (req, res) => {
  let audioPath = null;
  let convertedPath = null;

  try {
    const { url, language, shouldTranslate = false, shouldFormat = false } = req.body;
    
    if (!ytdl.validateURL(url)) {
      return res.status(400).json({ 
        error: 'URL do YouTube inválida' 
      });
    }

    console.log('Processando YouTube:', url);
    
    // Baixar áudio do YouTube
    audioPath = `temp_youtube_${Date.now()}.webm`;
    convertedPath = `temp_youtube_${Date.now()}.wav`;

    const audioStream = ytdl(url, {
      filter: 'audioonly',
      quality: 'highestaudio'
    });

    const writeStream = fs.createWriteStream(audioPath);
    audioStream.pipe(writeStream);

    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
      audioStream.on('error', reject);
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
    let transcription = result.text;

    // Processar o texto se solicitado
    if (shouldTranslate || shouldFormat) {
      console.log('Processando texto transcrito...');
      let processedText = transcription;

      if (shouldTranslate) {
        console.log('Traduzindo...');
        processedText = await translateText(processedText);
      }

      if (shouldFormat) {
        console.log('Formatando...');
        processedText = await formatText(processedText);
      }

      return res.json({ 
        originalTranscription: transcription,
        processedTranscription: processedText,
        confidence: result.confidence,
        language_detected: result.language_code,
        operations: {
          translated: shouldTranslate,
          formatted: shouldFormat
        }
      });
    }

    res.json({ 
      transcription,
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

// Rota para transcrever Instagram
app.post('/api/transcribe-instagram', async (req, res) => {
  try {
    const { url, language } = req.body;
    
    console.log('Processando Instagram:', url);
    
    // Para Instagram, você precisaria usar bibliotecas específicas
    // Por enquanto, simulação
    const transcription = `Transcrição simulada do Instagram usando AssemblyAI: ${url}\n\nEsta é uma demonstração. Para Instagram funcionar de verdade, você precisa:\n1. Implementar downloader do Instagram (instaloader, etc.)\n2. Configurar autenticação se necessário\n3. Processar diferentes tipos de mídia (Reels, IGTV, Posts)\n\nO conteúdo seria baixado, convertido e transcrito automaticamente usando AssemblyAI.`;

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

// Rota para upload de arquivo
app.post('/api/transcribe-file', upload.single('video'), async (req, res) => {
  let convertedPath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const language = req.body.language;
    const shouldTranslate = req.body.shouldTranslate === 'true';
    const shouldFormat = req.body.shouldFormat === 'true';

    console.log('Processando arquivo:', req.file.filename);

    // Validar arquivo
    try {
      const fileInfo = await validateMediaFile(req.file.path, req.file.originalname);
      console.log('Arquivo validado:', fileInfo);
    } catch (error) {
      console.error('Erro ao validar arquivo:', error);
      return res.status(400).json({ 
        error: 'Arquivo inválido: ' + error.message 
      });
    }

    // Definir caminho do arquivo de áudio convertido
    const fileExtension = path.extname(req.file.filename);
    const baseName = path.basename(req.file.filename, fileExtension);
    convertedPath = path.join('uploads', `${baseName}_converted.wav`);

    console.log('Convertendo para áudio...');

    // Converter para áudio compatível
    await convertVideoToAudio(req.file.path, convertedPath);

    // Transcrever com AssemblyAI
    const transcriptionOptions = {};
    if (language && language !== 'auto') {
      transcriptionOptions.language = language;
    }

    const result = await transcribeAudio(convertedPath, transcriptionOptions);
    let transcription = result.text;

    // Processar o texto se solicitado
    if (shouldTranslate || shouldFormat) {
      console.log('Processando texto transcrito...');
      let processedText = transcription;

      if (shouldTranslate) {
        console.log('Traduzindo...');
        processedText = await translateText(processedText);
      }

      if (shouldFormat) {
        console.log('Formatando...');
        processedText = await formatText(processedText);
      }

      return res.json({ 
        originalTranscription: transcription,
        processedTranscription: processedText,
        confidence: result.confidence,
        language_detected: result.language_code,
        operations: {
          translated: shouldTranslate,
          formatted: shouldFormat
        }
      });
    }

    res.json({ 
      transcription,
      confidence: result.confidence,
      language_detected: result.language_code
    });

  } catch (error) {
    console.error('Erro arquivo:', error);
    res.status(500).json({ 
      error: 'Erro ao processar arquivo: ' + error.message 
    });
  } finally {
    // Limpar arquivos
    cleanupFile(req.file?.path);
    cleanupFile(convertedPath);
  }
});

// Rota para obter idiomas suportados pelo AssemblyAI
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

// Rota de health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    hasAssemblyAI: !!(ASSEMBLYAI_API_KEY && ASSEMBLYAI_API_KEY !== 'sua-chave-aqui'),
    ffmpegPath: ffmpegStatic,
    service: 'AssemblyAI'
  });
});

// Rota para processar o texto (traduzir e formatar)
app.post('/api/process-text', async (req, res) => {
  try {
    const { text, shouldTranslate = true, shouldFormat = true } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Texto não fornecido' });
    }

    let processedText = text;

    // Traduzir se necessário
    if (shouldTranslate) {
      console.log('Traduzindo texto...');
      processedText = await translateText(processedText);
    }

    // Formatar se necessário
    if (shouldFormat) {
      console.log('Formatando texto...');
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

// Servir frontend em produção
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📱 Acesse: http://localhost:${PORT}`);
  console.log(`🔧 FFmpeg configurado: ${ffmpegStatic}`);
  console.log(`🤖 AssemblyAI configurado: ${!!(ASSEMBLYAI_API_KEY && ASSEMBLYAI_API_KEY !== 'sua-chave-aqui')}`);
  
  // Testar FFmpeg
  if (ffmpegStatic) {
    console.log('✅ FFmpeg encontrado e configurado');
  } else {
    console.log('❌ FFmpeg não encontrado - instale manualmente se necessário');
  }
});
