import React from 'react';
import { CabinRecord, PetRecord } from '../types/dashboard';
import './PetDigitalArchive.css';

interface PetDigitalArchiveProps {
  pets: PetRecord[];
  cabins: CabinRecord[];
}

const PetDigitalArchive: React.FC<PetDigitalArchiveProps> = ({ pets, cabins }) => {
  const cabinNameById = new Map(cabins.map(cabin => [cabin.id, cabin.id]));

  return (
    <div className="pet-digital-archive">
      <h2>宠物数字档案</h2>
      <div className="pets-container">
        {pets.map(pet => (
          <div key={pet.id} className="pet-card">
            <div className="pet-card-body">
              <div className="pet-header">
                <h3>{pet.name}</h3>
                <span className={`status ${pet.status}`}>
                  {pet.status === 'active' ? '在寄养中' : '已完成'}
                </span>
              </div>
              <div className="pet-info">
                <div className="info-item">
                  <label>品种：</label>
                  <span>{pet.breed}</span>
                </div>
                <div className="info-item">
                  <label>年龄：</label>
                  <span>{pet.age} 岁</span>
                </div>
                <div className="info-item">
                  <label>性别：</label>
                  <span>{pet.gender === 'male' ? '公' : '母'}</span>
                </div>
                <div className="info-item">
                  <label>体重：</label>
                  <span>{pet.weight}kg</span>
                </div>
                <div className="info-item">
                  <label>主人：</label>
                  <span>{pet.owner}</span>
                </div>
                <div className="info-item">
                  <label>联系电话：</label>
                  <span>{pet.contact}</span>
                </div>
                <div className="info-item">
                  <label>入住日期：</label>
                  <span>{pet.arrivalDate}</span>
                </div>
                <div className="info-item">
                  <label>来源设备：</label>
                  <span>{pet.cabinId ? cabinNameById.get(pet.cabinId) ?? pet.cabinId : '待分配'}</span>
                </div>
                <div className="info-item">
                  <label>特殊需求：</label>
                  <span>{pet.specialNeeds}</span>
                </div>
              </div>
              <div className="medical-history">
                <h4>医疗历史</h4>
                <ul>
                  {pet.medicalHistory.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PetDigitalArchive;
