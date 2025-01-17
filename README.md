# cocomat
please refer to the provided zip file for training data: 
[(to be uploaded)](https://drive.google.com/drive/folders/1Q0SPRiUncrwwulATalzZGy4ng4oyO1Uk?usp=sharing)

sample image:
<img width="1710" alt="SCR-20240922-qpln" src="https://github.com/user-attachments/assets/4af4b2f3-85af-4211-bbb0-8162b41e3afa">

to run backend:
$ cd backend
$ uvicorn app.main:app --port 8000 

to run frontend:
$ cd frontend
$ npm run dev

for raspi 
run npm run build
copy cocomat.tar.gz to raspi
tar xzf cocomat.tar.gz 
cd cocomat
./install.sh # not necessary because i already set up the venv
./start_server.sh

important: node 22.11.0

YOUR STACK
FE:
- Typescript
- React
- Vite

BE:
- Usual YOLOv8
- Ultralytics
- etc..
- FastAPI (python)