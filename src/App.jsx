import React, { useState } from 'react';
import { Upload, Link, Play, FileText, Copy, Loader2, CheckCircle, AlertCircle, Languages, Type } from 'lucide-react';

const VideoTranscriptionApp = () => {
  const [activeTab, setActiveTab] = useState('upload');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [processedTranscription, setProcessedTranscription] = useState('');
  const [status, setStatus] = useState('idle');
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isFormatting, setIsFormatting] = useState(false);

  // Função para chamar API do YouTube
  const handleYouTubeSubmit = async () => {
    if (!youtubeUrl.trim()) return;
    
    setIsProcessing(true);
    setStatus('processing');
    setTranscription('');
    setError('');
    
    try {
      const response = await fetch('/api/transcribe-youtube', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: youtubeUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao processar vídeo');
      }

      setTranscription(data.transcription);
      setStatus('completed');
    } catch (error) {
      console.error('Erro:', error);
      setError(error.message);
      setStatus('error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Função para chamar API do Instagram
  const handleInstagramSubmit = async () => {
    if (!instagramUrl.trim()) return;
    
    setIsProcessing(true);
    setStatus('processing');
    setTranscription('');
    setError('');
    
    try {
      const response = await fetch('/api/transcribe-instagram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: instagramUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao processar vídeo');
      }

      setTranscription(data.transcription);
      setStatus('completed');
    } catch (error) {
      console.error('Erro:', error);
      setError(error.message);
      setStatus('error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Função para upload de arquivo
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setUploadedFile(file);
    setIsProcessing(true);
    setStatus('processing');
    setTranscription('');
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('video', file);

      const response = await fetch('/api/transcribe-file', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao processar arquivo');
      }

      setTranscription(data.transcription);
      setStatus('completed');
    } catch (error) {
      console.error('Erro:', error);
      setError(error.message);
      setStatus('error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Função para processar o texto (traduzir/formatar)
  const processText = async (text, shouldTranslate, shouldFormat) => {
    try {
      setIsTranslating(shouldTranslate);
      setIsFormatting(shouldFormat);

      // Usar o texto processado se disponível, caso contrário usar a transcrição original
      const textToProcess = processedTranscription || text;

      const response = await fetch('/api/process-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: textToProcess,
          shouldTranslate,
          shouldFormat
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao processar texto');
      }

      setProcessedTranscription(data.processedText);
      setStatus('completed');
    } catch (error) {
      console.error('Erro:', error);
      setError(error.message);
      setStatus('error');
    } finally {
      setIsTranslating(false);
      setIsFormatting(false);
    }
  };

  // Função para copiar transcrição
  const copyTranscription = async () => {
    const textToCopy = processedTranscription || transcription;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      const textArea = document.createElement('textarea');
      textArea.value = textToCopy;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  // Função para resetar app
  const resetApp = () => {
    setYoutubeUrl('');
    setInstagramUrl('');
    setUploadedFile(null);
    setTranscription('');
    setProcessedTranscription('');
    setStatus('idle');
    setIsProcessing(false);
    setIsCopied(false);
    setError('');
    setIsTranslating(false);
    setIsFormatting(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Transcritor de Vídeos
          </h1>
          <p className="text-gray-600 text-lg">
            Converta áudio de vídeos em texto automaticamente
          </p>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('upload')}
                className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
                  activeTab === 'upload'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 hover:text-blue-500'
                }`}
              >
                <Upload className="w-5 h-5 inline-block mr-2" />
                Upload
              </button>
              <button
                onClick={() => setActiveTab('youtube')}
                className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
                  activeTab === 'youtube'
                    ? 'bg-red-500 text-white'
                    : 'text-gray-600 hover:text-red-500'
                }`}
              >
                <Play className="w-5 h-5 inline-block mr-2" />
                YouTube
              </button>
              <button
                onClick={() => setActiveTab('instagram')}
                className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
                  activeTab === 'instagram'
                    ? 'bg-pink-500 text-white'
                    : 'text-gray-600 hover:text-pink-500'
                }`}
              >
                <Link className="w-5 h-5 inline-block mr-2" />
                Instagram
              </button>
            </div>

            <div className="p-8">
              {/* Upload Tab */}
              {activeTab === 'upload' && (
                <div>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-700 mb-2">
                      Envie seu vídeo
                    </h3>
                    <p className="text-gray-500 mb-4">
                      Suporta MP4, AVI, MOV, MKV (até 100MB)
                    </p>
                    <input
                      type="file"
                      accept="video/*,audio/*"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                      disabled={isProcessing}
                    />
                    <label
                      htmlFor="file-upload"
                      className={`inline-block px-6 py-3 rounded-lg cursor-pointer transition-colors ${
                        isProcessing 
                          ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                    >
                      {isProcessing ? 'Processando...' : 'Escolher Arquivo'}
                    </label>
                    {uploadedFile && (
                      <p className="mt-4 text-sm text-gray-600">
                        Arquivo selecionado: {uploadedFile.name}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* YouTube Tab */}
              {activeTab === 'youtube' && (
                <div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                        <Play className="w-6 h-6 text-red-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-700">
                          YouTube
                        </h3>
                        <p className="text-gray-500 text-sm">
                          Cole o link do vídeo do YouTube
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <input
                        type="url"
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        disabled={isProcessing}
                      />
                      <button
                        onClick={handleYouTubeSubmit}
                        disabled={!youtubeUrl.trim() || isProcessing}
                        className="bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Play className="w-5 h-5" />
                        )}
                        Transcrever
                      </button>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <h4 className="font-medium text-red-800 mb-2">Formatos suportados:</h4>
                      <ul className="text-red-700 text-sm space-y-1">
                        <li>• Vídeos públicos do YouTube</li>
                        <li>• YouTube Shorts</li>
                        <li>• Listas de reprodução (vídeo individual)</li>
                        <li>• Máximo 2 horas de duração</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Instagram Tab */}
              {activeTab === 'instagram' && (
                <div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                        <Link className="w-6 h-6 text-pink-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-700">
                          Instagram
                        </h3>
                        <p className="text-gray-500 text-sm">
                          Cole o link do post, Reels ou IGTV
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <input
                        type="url"
                        value={instagramUrl}
                        onChange={(e) => setInstagramUrl(e.target.value)}
                        placeholder="https://www.instagram.com/p/..."
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                        disabled={isProcessing}
                      />
                      <button
                        onClick={handleInstagramSubmit}
                        disabled={!instagramUrl.trim() || isProcessing}
                        className="bg-pink-500 text-white px-6 py-3 rounded-lg hover:bg-pink-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Link className="w-5 h-5" />
                        )}
                        Transcrever
                      </button>
                    </div>
                    <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                      <h4 className="font-medium text-pink-800 mb-2">Formatos suportados:</h4>
                      <ul className="text-pink-700 text-sm space-y-1">
                        <li>• Posts com vídeo</li>
                        <li>• Instagram Reels</li>
                        <li>• IGTV</li>
                        <li>• Stories (se públicos)</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Status */}
              {status === 'processing' && (
                <div className="mt-8 p-4 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="flex items-center justify-center text-blue-600">
                    <Loader2 className="w-6 h-6 animate-spin mr-3" />
                    <span className="font-medium">Processando vídeo... Isso pode levar alguns minutos.</span>
                  </div>
                </div>
              )}
              
              {status === 'completed' && (
                <div className="mt-8 p-4 rounded-lg bg-green-50 border border-green-200">
                  <div className="flex items-center text-green-600">
                    <CheckCircle className="w-6 h-6 mr-3" />
                    <span className="font-medium">Transcrição concluída com sucesso!</span>
                  </div>
                </div>
              )}
              
              {status === 'error' && (
                <div className="mt-8 p-4 rounded-lg bg-red-50 border border-red-200">
                  <div className="flex items-center text-red-600">
                    <AlertCircle className="w-6 h-6 mr-3" />
                    <div>
                      <span className="font-medium">Erro ao processar:</span>
                      <p className="text-sm mt-1">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Transcription Result */}
              {transcription && (
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-700 flex items-center">
                      <FileText className="w-5 h-5 mr-2" />
                      Transcrição
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => processText(transcription, true, false)}
                        disabled={isTranslating || isFormatting}
                        className={`px-4 py-2 rounded-lg transition-colors flex items-center ${
                          isTranslating 
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                      >
                        {isTranslating ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Traduzindo...
                          </>
                        ) : (
                          <>
                            <Languages className="w-4 h-4 mr-2" />
                            Traduzir
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => processText(transcription, false, true)}
                        disabled={isTranslating || isFormatting}
                        className={`px-4 py-2 rounded-lg transition-colors flex items-center ${
                          isFormatting 
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-purple-500 text-white hover:bg-purple-600'
                        }`}
                      >
                        {isFormatting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Formatando...
                          </>
                        ) : (
                          <>
                            <Type className="w-4 h-4 mr-2" />
                            Formatar
                          </>
                        )}
                      </button>
                      <button
                        onClick={copyTranscription}
                        className={`px-4 py-2 rounded-lg transition-colors flex items-center ${
                          isCopied 
                            ? 'bg-green-500 text-white' 
                            : 'bg-gray-500 text-white hover:bg-gray-600'
                        }`}
                      >
                        {isCopied ? (
                          <>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Copiado!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-2" />
                            Copiar
                          </>
                        )}
                      </button>
                      <button
                        onClick={resetApp}
                        className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
                      >
                        Novo Vídeo
                      </button>
                    </div>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                    <pre className="whitespace-pre-wrap text-gray-700 text-sm font-sans">
                      {processedTranscription || transcription}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoTranscriptionApp;
