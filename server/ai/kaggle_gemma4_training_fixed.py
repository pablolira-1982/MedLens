import json
import os
import random
import shutil

import torch
from datasets import load_dataset
from trl import SFTConfig, SFTTrainer
from unsloth import FastLanguageModel


MODEL_NAME = "google/gemma-4-e2b-it"
BASE_DATASET = "medical_instructions_robust.jsonl"
BIG_DATASET = "medical_instructions_big.jsonl"
OUTPUT_DIR = "gemma-health-edge-adapters"
ZIP_NAME = "gemma_health_adapters_big"
MAX_SEQ_LENGTH = 2048


def build_text(instruction: str, answer: str) -> str:
    return (
        "<start_of_turn>user\n"
        f"{instruction.strip()}<end_of_turn>\n"
        "<start_of_turn>model\n"
        f"{answer.strip()}<end_of_turn>"
    )


def generate_bigger_dataset(output_path: str = BIG_DATASET, target_size: int = 1500) -> None:
    symptoms = [
        ("dor de cabeca", "ha quanto tempo comecou, intensidade da dor e se ha febre, rigidez na nuca, confusao ou perda de forca"),
        ("febre", "temperatura medida, duracao, idade, sinais de falta de ar, sonolencia ou piora importante"),
        ("dor no peito", "se a dor aperta, irradia para braco/mandibula, vem com falta de ar, suor frio ou nausea"),
        ("dor abdominal", "localizacao, duracao, vomitos, sangue nas fezes, febre ou dor forte progressiva"),
        ("tontura", "se ha desmaio, fraqueza de um lado, fala enrolada, dor no peito ou falta de ar"),
        ("tosse", "duracao, febre, falta de ar, chiado, sangue no escarro ou dor no peito"),
        ("diarreia", "duracao, sangue, sinais de desidratacao, febre alta ou dor abdominal intensa"),
        ("dor nas costas", "se houve trauma, febre, perda de forca, dormencia ou perda de urina/fezes"),
        ("alergia", "gatilho provavel, falta de ar, inchaco em rosto/labios ou urticaria espalhada"),
        ("queimadura", "tamanho, profundidade, local, bolhas e se atingiu rosto, maos, genitais ou articulacoes"),
    ]

    medication_cases = [
        ("metformina", "nausea, desconforto abdominal e diarreia podem ocorrer; sinais graves como fraqueza intensa e respiracao dificil exigem avaliacao urgente"),
        ("losartana", "tontura e queda de pressao podem ocorrer; inchaço, desmaio ou piora renal precisam de avaliacao"),
        ("amoxicilina", "diarreia e alergia podem ocorrer; falta de ar, inchaco ou manchas extensas exigem urgencia"),
        ("ibuprofeno", "pode irritar estomago e rim; evitar em ulcera ativa, doenca renal importante ou sangramento"),
        ("paracetamol", "respeitar dose maxima diaria; excesso pode causar lesao grave no figado"),
        ("omeprazol", "uso prolongado deve ser revisado; pode mascarar sintomas importantes se houver perda de peso ou sangue"),
        ("prednisona", "nao interromper uso prolongado de repente; pode aumentar glicose, pressao e risco de infeccao"),
        ("sinvastatina", "dor muscular intensa ou urina escura precisam de avaliacao"),
    ]

    examples = []

    if os.path.exists(BASE_DATASET):
        with open(BASE_DATASET, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                item = json.loads(line)
                text = item.get("text")
                if isinstance(text, str) and text.strip():
                    examples.append({"text": text.strip()})

    for symptom, needed_info in symptoms:
        examples.append({
            "text": build_text(
                f"Estou com {symptom}. O que devo fazer?",
                f"Para orientar com mais precisao, preciso saber {needed_info}. Se houver sinal de alarme, procure atendimento imediatamente. Enquanto isso, observe evolucao, hidratacao e intensidade dos sintomas."
            )
        })
        examples.append({
            "text": build_text(
                f"Analise este relato: paciente com {symptom} e pouca informacao.",
                f"A informacao ainda e insuficiente para uma orientacao precisa. A pergunta mais importante agora e: {needed_info}? Com esses dados, posso diferenciar algo leve de um sinal de urgencia."
            )
        })

    for med, safety in medication_cases:
        examples.append({
            "text": build_text(
                f"Quais cuidados devo ter com {med}?",
                f"Com {med}, o principal e confirmar dose, horario, idade, gravidez, alergias e outros remedios em uso. {safety}. Nao altere dose sem orientacao profissional."
            )
        })
        examples.append({
            "text": build_text(
                f"Explique uma receita que menciona {med}.",
                f"A receita com {med} deve ser seguida exatamente quanto a dose, intervalo e duracao. Verifique alergias, interacoes e efeitos inesperados. Se houver reacao intensa ou piora rapida, procure atendimento."
            )
        })

    templates = []
    for symptom, needed_info in symptoms:
        templates.extend([
            (
                f"Paciente relata {symptom}. Faca triagem objetiva.",
                f"Primeiro, confirme {needed_info}. Depois avalie sinais de alarme e duracao. Se nao houver alarme, oriente medidas seguras e acompanhamento; se houver, atendimento imediato."
            ),
            (
                f"Audio transcrito: estou com {symptom}, nao sei se e grave.",
                f"A gravidade depende de {needed_info}. Se algum desses sinais estiver presente, procure atendimento agora. Se nao, acompanhe sintomas e informe duracao e intensidade."
            ),
            (
                f"Imagem/OCR de anotacao medica cita {symptom}. Resuma para o paciente.",
                f"O texto parece relacionado a {symptom}. Para orientar melhor, confirme {needed_info}. Nao vou inventar detalhes alem do texto reconhecido."
            ),
        ])

    while len(examples) < target_size:
        instruction, answer = random.choice(templates)
        variation = random.choice([
            "Responda curto e com seguranca.",
            "Faca apenas uma pergunta se faltar dado.",
            "Evite repetir orientacoes genericas.",
            "Priorize sinais de alarme.",
        ])
        examples.append({"text": build_text(f"{instruction} {variation}", answer)})

    random.shuffle(examples)
    with open(output_path, "w", encoding="utf-8") as f:
        for item in examples[:target_size]:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")

    print(f"Dataset criado: {output_path} com {target_size} exemplos")


def main() -> None:
    generate_bigger_dataset()

    dataset = load_dataset("json", data_files=BIG_DATASET, split="train")
    dataset = dataset.filter(lambda row: isinstance(row.get("text"), str) and len(row["text"].strip()) > 0)

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=MODEL_NAME,
        max_seq_length=MAX_SEQ_LENGTH,
        load_in_4bit=True,
    )
    text_tokenizer = getattr(tokenizer, "tokenizer", tokenizer)
    if text_tokenizer.pad_token is None:
        text_tokenizer.pad_token = text_tokenizer.eos_token

    model = FastLanguageModel.get_peft_model(
        model,
        r=16,
        target_modules=[
            "q_proj",
            "k_proj",
            "v_proj",
            "o_proj",
            "gate_proj",
            "up_proj",
            "down_proj",
        ],
        lora_alpha=16,
        lora_dropout=0,
        bias="none",
        use_gradient_checkpointing="unsloth",
    )

    def formatting_prompts_func(examples):
        texts = examples["text"]
        if isinstance(texts, str):
            texts = [texts]
        return [str(text).strip() for text in texts]

    trainer = SFTTrainer(
        model=model,
        train_dataset=dataset,
        formatting_func=formatting_prompts_func,
        processing_class=text_tokenizer,
        args=SFTConfig(
            per_device_train_batch_size=2,
            gradient_accumulation_steps=4,
            max_steps=120,
            learning_rate=2e-4,
            fp16=not torch.cuda.is_bf16_supported(),
            bf16=torch.cuda.is_bf16_supported(),
            logging_steps=5,
            optim="adamw_8bit",
            output_dir="outputs",
            dataset_num_proc=1,
            report_to="none",
            packing=False,
            max_seq_length=MAX_SEQ_LENGTH,
        ),
    )

    trainer.train()
    model.save_pretrained(OUTPUT_DIR)
    text_tokenizer.save_pretrained(OUTPUT_DIR)
    shutil.make_archive(ZIP_NAME, "zip", OUTPUT_DIR)
    print(f"Treinamento concluido. Arquivo gerado: {ZIP_NAME}.zip")


if __name__ == "__main__":
    main()
