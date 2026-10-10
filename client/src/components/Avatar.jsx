export default function Avatar({ user, size = 32 }) {
  const style = { width: size, height: size, fontSize: size * 0.42 };
  return user.avatar
    ? <img className="avatar" style={style} src={user.avatar} alt="" />
    : <span className="avatar" style={style}>{user.name[0]}</span>;
}

/** Recorta a imagem em quadrado, reduz para 128px e devolve um data URL JPEG pequeno. */
export function resizeAvatar(file, size = 128) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      canvas.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler a imagem.')); };
    img.src = url;
  });
}
